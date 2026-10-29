import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { CloudinaryService } from '../files/cloudinary.service';
import {
  ATTACHMENT_MIME_TO_EXT,
  HEALTH_ATTACHMENT_KIND,
} from '../files/upload';
import { HorsesService } from '../horses/horses.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateHealthRecordDto,
  ListHealthRecordsQueryDto,
  UpdateHealthRecordDto,
} from './dto/health.dto';

const RECORD_INCLUDE = {
  vet: { select: { id: true, name: true, email: true } },
  horse: { select: { id: true, name: true, ownerId: true } },
} satisfies Prisma.HealthRecordInclude;

type RecordWithRelations = Prisma.HealthRecordGetPayload<{
  include: typeof RECORD_INCLUDE;
}>;

export interface HealthRecordView extends RecordWithRelations {
  attachmentUrl: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

// Keep in sync with the global prefix in main.ts.
const API_PREFIX = '/api/v1';

@Injectable()
export class HealthRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly cloudinary: CloudinaryService,
    private readonly horses: HorsesService,
  ) {}

  private toView(record: RecordWithRelations): HealthRecordView {
    return {
      ...record,
      attachmentUrl: record.attachmentPath
        ? record.attachmentPath.startsWith('http')
          ? record.attachmentPath
          : `${API_PREFIX}/files/${record.attachmentPath}`
        : null,
    };
  }

  private assertHorseVisible(
    horse: { ownerId: string } | null | undefined,
    user: AuthUser,
  ): void {
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    if (user.role === Role.OWNER && horse.ownerId !== user.id) {
      throw new AppException(
        'FORBIDDEN',
        'This horse belongs to another owner',
      );
    }
  }

  private parseExamDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppException(
        'VALIDATION_ERROR',
        'examDate is not a valid date',
      );
    }
    if (date.getTime() > Date.now()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'examDate cannot be in the future',
      );
    }
    return date;
  }

  async create(
    horseId: string,
    dto: CreateHealthRecordDto,
    vet: AuthUser,
  ): Promise<HealthRecordView> {
    // Route guard already 404s a missing horse; keep the service honest.
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    const record = await this.prisma.healthRecord.create({
      data: {
        horseId,
        vetId: vet.id,
        examDate: this.parseExamDate(dto.examDate),
        diagnosis: dto.diagnosis.trim(),
        treatment: dto.treatment?.trim() ?? null,
      },
      include: RECORD_INCLUDE,
    });

    // Phase 10 (UC-15) — only when the VET explicitly sends it; no other
    // route writes Horse.healthStatus (see phase-10 spec §5, decision #2).
    if (dto.healthStatus !== undefined) {
      await this.prisma.horse.update({
        where: { id: horseId },
        data: { healthStatus: dto.healthStatus },
      });
    }

    // Proactive AI risk check — never blocks/fails this response (see
    // HorsesService.checkRiskAndNotify).
    await this.horses.checkRiskAndNotify(horseId);

    return this.toView(record);
  }

  async listByHorse(
    horseId: string,
    q: ListHealthRecordsQueryDto,
  ): Promise<Paginated<HealthRecordView>> {
    const examDate: Prisma.DateTimeFilter = {};
    if (q.from) examDate.gte = new Date(q.from);
    if (q.to) examDate.lte = new Date(q.to);

    const where: Prisma.HealthRecordWhereInput = {
      horseId,
      ...(q.from || q.to ? { examDate } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.healthRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        orderBy: [{ examDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.healthRecord.count({ where }),
    ]);
    return {
      data: data.map((r) => this.toView(r)),
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  async listAll(
    q: ListHealthRecordsQueryDto,
    user: AuthUser,
  ): Promise<Paginated<HealthRecordView>> {
    const where: Prisma.HealthRecordWhereInput = {
      horse: {
        deletedAt: null,
        ...(user.role === Role.OWNER ? { ownerId: user.id } : {}),
        ...(q.healthStatus ? { healthStatus: q.healthStatus } : {}),
        ...(q.q ? { name: { contains: q.q.trim(), mode: 'insensitive' } } : {}),
      },
      ...(q.from || q.to
        ? {
            examDate: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.healthRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        orderBy: [{ examDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.healthRecord.count({ where }),
    ]);
    return {
      data: data.map((r) => this.toView(r)),
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  async horseSummary(user: AuthUser) {
    const where = {
      deletedAt: null,
      ...(user.role === Role.OWNER ? { ownerId: user.id } : {}),
    };
    const groupsQuery = this.prisma.horse.groupBy({
      by: ['healthStatus'],
      orderBy: { healthStatus: 'asc' },
      where,
      _count: { _all: true },
    });
    const [groups, locked] = await this.prisma.$transaction([
      groupsQuery,
      this.prisma.horse.count({ where: { ...where, locked: true } }),
    ]);
    const counts = { FIT: 0, MONITORING: 0, INJURED: 0, QUARANTINED: 0 };
    for (const group of groups) counts[group.healthStatus] = group._count._all;
    return {
      counts,
      locked,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }

  async get(id: string, user: AuthUser): Promise<HealthRecordView> {
    const record = await this.prisma.healthRecord.findUnique({
      where: { id },
      include: RECORD_INCLUDE,
    });
    if (!record) throw new AppException('NOT_FOUND', 'Health record not found');
    this.assertHorseVisible(record.horse, user);
    return this.toView(record);
  }

  async update(
    id: string,
    dto: UpdateHealthRecordDto,
  ): Promise<HealthRecordView> {
    const sent = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (sent.length === 0) {
      throw new AppException('VALIDATION_ERROR', 'No fields to update');
    }
    const existing = await this.prisma.healthRecord.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new AppException('NOT_FOUND', 'Health record not found');
    }

    const data: Prisma.HealthRecordUpdateInput = {};
    if (dto.examDate !== undefined)
      data.examDate = this.parseExamDate(dto.examDate);
    if (dto.diagnosis !== undefined) data.diagnosis = dto.diagnosis.trim();
    if (dto.treatment !== undefined) {
      data.treatment = dto.treatment === null ? null : dto.treatment.trim();
    }

    const record = await this.prisma.healthRecord.update({
      where: { id },
      data,
      include: RECORD_INCLUDE,
    });
    return this.toView(record);
  }

  /**
   * Uploads to Cloudinary when configured (survives a Render redeploy);
   * falls back to local disk otherwise (local dev only — see
   * CloudinaryService). PDFs upload as Cloudinary `resource_type: 'raw'`.
   */
  async saveAttachment(
    id: string,
    file: Express.Multer.File,
  ): Promise<HealthRecordView> {
    const ext = ATTACHMENT_MIME_TO_EXT[file.mimetype];
    const publicId = `${id}-${randomBytes(4).toString('hex')}`;
    let attachmentPath: string;
    if (this.cloudinary.enabled) {
      const resourceType =
        file.mimetype === 'application/pdf' ? 'raw' : 'image';
      attachmentPath = await this.cloudinary.uploadBuffer(
        file.buffer,
        HEALTH_ATTACHMENT_KIND,
        publicId,
        resourceType,
      );
    } else {
      const filename = `${publicId}.${ext}`;
      this.storage.saveBuffer(HEALTH_ATTACHMENT_KIND, filename, file.buffer);
      attachmentPath = `${HEALTH_ATTACHMENT_KIND}/${filename}`;
    }
    return this.setAttachment(id, attachmentPath);
  }

  async setAttachment(
    id: string,
    attachmentPath: string,
  ): Promise<HealthRecordView> {
    const current = await this.prisma.healthRecord.findUnique({
      where: { id },
      select: { attachmentPath: true },
    });
    if (!current) {
      throw new AppException('NOT_FOUND', 'Health record not found');
    }
    const record = await this.prisma.healthRecord.update({
      where: { id },
      data: { attachmentPath },
      include: RECORD_INCLUDE,
    });
    if (current.attachmentPath && current.attachmentPath !== attachmentPath) {
      if (current.attachmentPath.startsWith('http')) {
        void this.cloudinary.destroyByUrl(current.attachmentPath);
      } else {
        this.storage.removeQuietly(current.attachmentPath);
      }
    }
    return this.toView(record);
  }

  /** Ownership-checked lookup used when serving an attachment file. */
  async findForAttachment(
    attachmentPath: string,
    user: AuthUser,
  ): Promise<void> {
    const record = await this.prisma.healthRecord.findFirst({
      where: { attachmentPath },
      select: { horse: { select: { ownerId: true } } },
    });
    if (!record) throw new AppException('NOT_FOUND', 'File not found');
    this.assertHorseVisible(record.horse, user);
  }
}
