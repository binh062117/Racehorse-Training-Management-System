import { Injectable } from '@nestjs/common';
import {
  IncidentSeverity,
  IncidentStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HorsesService } from '../horses/horses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FileStorageService } from '../files/file-storage.service';
import { CloudinaryService } from '../files/cloudinary.service';
import { INCIDENT_PHOTO_KIND, MIME_TO_EXT } from '../files/upload';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { Paginated } from '../horses/horses.service';
import {
  CreateIncidentDto,
  ListIncidentsQueryDto,
  UpdateIncidentDto,
} from './dto/incidents.dto';

const INCIDENT_INCLUDE = {
  reportedBy: { select: { id: true, name: true, email: true } },
  horse: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      locked: true,
      lockIncidentId: true,
    },
  },
  healthRecord: {
    select: { id: true, examDate: true, diagnosis: true, healthStatus: true },
  },
} satisfies Prisma.IncidentReportInclude;

type IncidentWithRelations = Prisma.IncidentReportGetPayload<{
  include: typeof INCIDENT_INCLUDE;
}>;

export interface IncidentView extends IncidentWithRelations {
  photoUrl: string | null;
}

// Forward-only status progression; skipping ahead (OPEN -> RESOLVED) is allowed.
const STATUS_ORDER: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.IN_PROGRESS,
  IncidentStatus.RESOLVED,
];

// Keep in sync with the global prefix in main.ts.
const API_PREFIX = '/api/v1';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly horses: HorsesService,
    private readonly notifications: NotificationsService,
    private readonly storage: FileStorageService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private toView(incident: IncidentWithRelations): IncidentView {
    return {
      ...incident,
      photoUrl: incident.photoPath
        ? incident.photoPath.startsWith('http')
          ? incident.photoPath
          : `${API_PREFIX}/files/${incident.photoPath}`
        : null,
    };
  }

  private assertHorseVisible(
    horse: { ownerId: string } | null,
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

  async create(
    horseId: string,
    dto: CreateIncidentDto,
    reporter: AuthUser,
  ): Promise<IncidentView> {
    // Route guard already 404s a missing horse, but keep the service honest.
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    const incident = await this.prisma.incidentReport.create({
      data: {
        horseId,
        reportedById: reporter.id,
        description: dto.description.trim(),
        severity: dto.severity,
      },
      include: INCIDENT_INCLUDE,
    });

    // A HIGH incident locks the horse — unless it is already locked for
    // another reason, whose lock (and the right to lift it) stays as it was.
    if (dto.severity === IncidentSeverity.HIGH) {
      await this.horses.lockForIncident(
        horseId,
        incident.id,
        incident.description,
        reporter.id,
      );
    }

    const managerIds = await this.notifications.managerIds();
    await this.notifications.notifyUsers(
      [horse.ownerId, ...managerIds],
      NotificationType.INCIDENT_REPORTED,
      `Sự cố mới (${dto.severity}) cho ${incident.horse.name}: ${incident.description}`,
    );

    // Proactive AI risk check — skip LOW severity to save API calls on
    // routine entries. Never blocks/fails this response (see HorsesService).
    if (dto.severity !== IncidentSeverity.LOW) {
      await this.horses.checkRiskAndNotify(horseId);
    }

    return this.toView(incident);
  }

  async listByHorse(
    horseId: string,
    q: ListIncidentsQueryDto,
  ): Promise<Paginated<IncidentView>> {
    const where: Prisma.IncidentReportWhereInput = {
      horseId,
      ...(q.status ? { status: q.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.incidentReport.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.incidentReport.count({ where }),
    ]);
    return {
      data: data.map((i) => this.toView(i)),
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  /**
   * Club-wide list for the Incidents screen: filter by status / severity /
   * free text, sort newest first or most severe first, paginated. An owner
   * only ever sees incidents on their own horses.
   */
  async listAll(
    q: ListIncidentsQueryDto,
    user: AuthUser,
  ): Promise<Paginated<IncidentView> & { counts: Record<string, number> }> {
    const scope: Prisma.IncidentReportWhereInput = {
      horse: {
        deletedAt: null,
        ...(user.role === Role.OWNER ? { ownerId: user.id } : {}),
      },
    };
    const text = q.q?.trim();
    if (text) {
      scope.OR = [
        { description: { contains: text, mode: 'insensitive' } },
        { horse: { name: { contains: text, mode: 'insensitive' } } },
        { reportedBy: { name: { contains: text, mode: 'insensitive' } } },
      ];
    }
    const where: Prisma.IncidentReportWhereInput = {
      ...scope,
      ...(q.status ? { status: q.status } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
    };
    // Enum columns sort in declaration order (LOW < MEDIUM < HIGH), so desc puts HIGH first.
    const orderBy: Prisma.IncidentReportOrderByWithRelationInput[] =
      q.sort === 'severity'
        ? [{ severity: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const [data, total, byStatus, bySeverity] = await this.prisma.$transaction([
      this.prisma.incidentReport.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.incidentReport.count({ where }),
      this.prisma.incidentReport.groupBy({
        by: ['status'],
        where: { ...scope, ...(q.severity ? { severity: q.severity } : {}) },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.incidentReport.groupBy({
        by: ['severity'],
        where: { ...scope, ...(q.status ? { status: q.status } : {}) },
        orderBy: { severity: 'asc' },
        _count: { _all: true },
      }),
    ]);
    // Counts for the filter chips: each axis is counted under the other axis' filter.
    const counts: Record<string, number> = {};
    for (const r of byStatus)
      counts[r.status] = (r._count as { _all: number })._all;
    for (const r of bySeverity)
      counts[r.severity] = (r._count as { _all: number })._all;
    return {
      data: data.map((i) => this.toView(i)),
      meta: { page: q.page, limit: q.limit, total },
      counts,
    };
  }

  async get(id: string, user: AuthUser): Promise<IncidentView> {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) throw new AppException('NOT_FOUND', 'Incident not found');
    this.assertHorseVisible(incident.horse, user);
    return this.toView(incident);
  }

  async update(
    id: string,
    dto: UpdateIncidentDto,
    user?: AuthUser,
  ): Promise<IncidentView & { horseUnlocked: boolean }> {
    const existing = await this.prisma.incidentReport.findUnique({
      where: { id },
      select: { status: true, horseId: true, healthRecordId: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Incident not found');

    if (existing.status === IncidentStatus.RESOLVED) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Incident is already RESOLVED',
      );
    }

    if (dto.status !== undefined) {
      const currentIdx = STATUS_ORDER.indexOf(existing.status);
      const nextIdx = STATUS_ORDER.indexOf(dto.status);
      if (nextIdx < currentIdx) {
        throw new AppException(
          'VALIDATION_ERROR',
          'Incident status can only move forward',
        );
      }
    }

    // Closing an incident needs the vet's exam that goes with it.
    const recordId = dto.healthRecordId ?? existing.healthRecordId;
    if (dto.status === IncidentStatus.RESOLVED && !recordId) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Cần chọn hồ sơ khám của bác sĩ đi kèm để đóng sự cố.',
      );
    }

    let record: { healthStatus: string | null } | null = null;
    if (recordId) {
      const found = await this.prisma.healthRecord.findUnique({
        where: { id: recordId },
        select: { horseId: true, healthStatus: true },
      });
      if (!found || found.horseId !== existing.horseId) {
        throw new AppException(
          'VALIDATION_ERROR',
          'healthRecordId must reference a health record for this horse',
        );
      }
      record = found;
    }

    const data: Prisma.IncidentReportUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.healthRecordId !== undefined)
      data.healthRecord = { connect: { id: dto.healthRecordId } };

    await this.prisma.incidentReport.update({ where: { id }, data });

    // Resolving lifts the lock only when this very incident set it, and only
    // on an exam that concludes the horse is fit; any other lock stays.
    let horseUnlocked = false;
    if (dto.status === IncidentStatus.RESOLVED && recordId) {
      const horse = await this.prisma.horse.findUnique({
        where: { id: existing.horseId },
        select: { locked: true, lockIncidentId: true },
      });
      if (
        horse?.locked &&
        horse.lockIncidentId === id &&
        record?.healthStatus === 'FIT'
      ) {
        await this.horses.unlockForIncident(
          existing.horseId,
          id,
          recordId,
          user?.id ?? null,
        );
        horseUnlocked = true;
      }
    }

    const incident = await this.prisma.incidentReport.findUniqueOrThrow({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    return { ...this.toView(incident), horseUnlocked };
  }

  /**
   * UC-19 (Phase 10) — 1 photo/incident, overwrite. Uploads to Cloudinary
   * when configured (survives a Render redeploy); falls back to local disk
   * otherwise (local dev only — see CloudinaryService).
   */
  async savePhoto(
    id: string,
    file: Express.Multer.File,
  ): Promise<IncidentView> {
    const ext = MIME_TO_EXT[file.mimetype];
    const publicId = `${id}-${randomBytes(4).toString('hex')}`;
    let photoPath: string;
    if (this.cloudinary.enabled) {
      photoPath = await this.cloudinary.uploadBuffer(
        file.buffer,
        INCIDENT_PHOTO_KIND,
        publicId,
      );
    } else {
      const filename = `${publicId}.${ext}`;
      this.storage.saveBuffer(INCIDENT_PHOTO_KIND, filename, file.buffer);
      photoPath = `${INCIDENT_PHOTO_KIND}/${filename}`;
    }
    return this.setPhoto(id, photoPath);
  }

  async setPhoto(id: string, photoPath: string): Promise<IncidentView> {
    const current = await this.prisma.incidentReport.findUnique({
      where: { id },
      select: { photoPath: true },
    });
    if (!current) throw new AppException('NOT_FOUND', 'Incident not found');

    const incident = await this.prisma.incidentReport.update({
      where: { id },
      data: { photoPath },
      include: INCIDENT_INCLUDE,
    });
    if (current.photoPath && current.photoPath !== photoPath) {
      if (current.photoPath.startsWith('http')) {
        void this.cloudinary.destroyByUrl(current.photoPath);
      } else {
        this.storage.removeQuietly(current.photoPath);
      }
    }
    return this.toView(incident);
  }

  /** Ownership-checked lookup used when serving an incident photo file. */
  async findForPhoto(photoPath: string, user: AuthUser): Promise<void> {
    const incident = await this.prisma.incidentReport.findFirst({
      where: { photoPath },
      select: { horse: { select: { ownerId: true } } },
    });
    if (!incident) throw new AppException('NOT_FOUND', 'File not found');
    this.assertHorseVisible(incident.horse, user);
  }
}
