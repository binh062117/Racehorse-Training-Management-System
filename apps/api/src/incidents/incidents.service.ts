import { Injectable } from '@nestjs/common';
import {
  IncidentSeverity,
  IncidentStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorsesService } from '../horses/horses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FileStorageService } from '../files/file-storage.service';
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
  horse: { select: { id: true, name: true, ownerId: true } },
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
  ) {}

  private toView(incident: IncidentWithRelations): IncidentView {
    return {
      ...incident,
      photoUrl: incident.photoPath
        ? `${API_PREFIX}/files/${incident.photoPath}`
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

    if (dto.severity === IncidentSeverity.HIGH) {
      await this.horses.lock(horseId, {
        locked: true,
        reason: `Incident: ${incident.description}`,
      });
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

  async get(id: string, user: AuthUser): Promise<IncidentView> {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) throw new AppException('NOT_FOUND', 'Incident not found');
    this.assertHorseVisible(incident.horse, user);
    return this.toView(incident);
  }

  async update(id: string, dto: UpdateIncidentDto): Promise<IncidentView> {
    const existing = await this.prisma.incidentReport.findUnique({
      where: { id },
      select: { status: true, horseId: true },
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

    if (dto.healthRecordId !== undefined) {
      const record = await this.prisma.healthRecord.findUnique({
        where: { id: dto.healthRecordId },
        select: { horseId: true },
      });
      if (!record || record.horseId !== existing.horseId) {
        throw new AppException(
          'VALIDATION_ERROR',
          'healthRecordId must reference a health record for this horse',
        );
      }
    }

    const data: Prisma.IncidentReportUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.healthRecordId !== undefined)
      data.healthRecord = { connect: { id: dto.healthRecordId } };

    const incident = await this.prisma.incidentReport.update({
      where: { id },
      data,
      include: INCIDENT_INCLUDE,
    });

    if (dto.status === IncidentStatus.RESOLVED) {
      const horse = await this.prisma.horse.findUnique({
        where: { id: existing.horseId },
        select: { locked: true },
      });
      if (horse?.locked) {
        await this.horses.lock(existing.horseId, { locked: false });
      }
    }

    return this.toView(incident);
  }

  /** UC-19 (Phase 10) — 1 photo/incident, overwrite, best-effort delete of the old file. */
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
      this.storage.removeQuietly(current.photoPath);
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
