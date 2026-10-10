import { Injectable, Logger } from '@nestjs/common';
import { Horse, NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AiService,
  FeedingSuggestionResult,
  HorseInsightResult,
} from '../ai/ai.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateHorseDto,
  ListHorsesQueryDto,
  LockHorseDto,
  UpdateHorseDto,
} from './dto/horses.dto';

const OWNER_SELECT = { id: true, name: true, email: true } as const;

type HorseWithOwner = Prisma.HorseGetPayload<{
  include: { owner: { select: typeof OWNER_SELECT } };
}>;

export interface HorseView extends HorseWithOwner {
  photoUrl: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

// photoUrl is built for the frontend; keep in sync with the prefix in main.ts.
const API_PREFIX = '/api/v1';

@Injectable()
export class HorsesService {
  private readonly logger = new Logger('Horses');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly notifications: NotificationsService,
    private readonly ai: AiService,
  ) {}

  private toView(horse: HorseWithOwner): HorseView {
    return {
      ...horse,
      photoUrl: horse.photoPath
        ? `${API_PREFIX}/files/${horse.photoPath}`
        : null,
    };
  }

  /** Validates that `ownerId` is an existing, non-deleted OWNER user. */
  private async assertOwner(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, deletedAt: null },
      select: { role: true },
    });
    if (!owner || owner.role !== Role.OWNER) {
      throw new AppException(
        'VALIDATION_ERROR',
        'ownerId must reference an existing OWNER user',
      );
    }
  }

  /**
   * Validates sireId/damId on `update`: each (if set) must reference an
   * existing, non-deleted horse other than `id` itself, and they must not
   * both point at the same horse. Does not walk the ancestor tree — see
   * docs/specs/phase-6-pedigree.md §5.4.
   */
  private async assertPedigree(
    horseId: string,
    sireId: string | null | undefined,
    damId: string | null | undefined,
  ): Promise<void> {
    if (sireId && sireId === horseId) {
      throw new AppException(
        'VALIDATION_ERROR',
        'sireId cannot be the horse itself',
      );
    }
    if (damId && damId === horseId) {
      throw new AppException(
        'VALIDATION_ERROR',
        'damId cannot be the horse itself',
      );
    }
    if (sireId && damId && sireId === damId) {
      throw new AppException(
        'VALIDATION_ERROR',
        'sireId and damId cannot be the same horse',
      );
    }
    const ids = [sireId, damId].filter((v): v is string => !!v);
    if (ids.length === 0) return;
    const found = await this.prisma.horse.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new AppException(
        'VALIDATION_ERROR',
        'sireId/damId must reference an existing horse',
      );
    }
  }

  private parseBirthDate(
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppException(
        'VALIDATION_ERROR',
        'birthDate is not a valid date',
      );
    }
    if (date.getTime() > Date.now()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'birthDate cannot be in the future',
      );
    }
    return date;
  }

  async create(dto: CreateHorseDto): Promise<HorseView> {
    await this.assertOwner(dto.ownerId);
    const horse = await this.prisma.horse.create({
      data: {
        name: dto.name.trim(),
        ownerId: dto.ownerId,
        gender: dto.gender ?? null,
        breed: dto.breed?.trim() ?? null,
        birthDate: this.parseBirthDate(dto.birthDate) ?? null,
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: { owner: { select: OWNER_SELECT } },
    });
    return this.toView(horse);
  }

  async list(
    q: ListHorsesQueryDto,
    currentUser: AuthUser,
  ): Promise<Paginated<HorseView>> {
    const ownerId =
      currentUser.role === Role.OWNER ? currentUser.id : q.ownerId;

    const where: Prisma.HorseWhereInput = {
      deletedAt: null,
      ...(ownerId ? { ownerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.healthStatus ? { healthStatus: q.healthStatus } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.horse.findMany({
        where,
        include: { owner: { select: OWNER_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.horse.count({ where }),
    ]);

    return {
      data: rows.map((h) => this.toView(h)),
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  /** Ownership already enforced by HorseOwnershipGuard; re-read with owner join. */
  async get(id: string): Promise<HorseView> {
    const horse = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      include: { owner: { select: OWNER_SELECT } },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    return this.toView(horse);
  }

  async update(id: string, dto: UpdateHorseDto): Promise<HorseView> {
    const existing = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Horse not found');
    if (dto.ownerId) await this.assertOwner(dto.ownerId);
    if (dto.sireId !== undefined || dto.damId !== undefined) {
      await this.assertPedigree(id, dto.sireId, dto.damId);
    }

    const data: Prisma.HorseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.breed !== undefined) data.breed = dto.breed?.trim() ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.ownerId !== undefined)
      data.owner = { connect: { id: dto.ownerId } };
    const birthDate = this.parseBirthDate(dto.birthDate);
    if (birthDate !== undefined) data.birthDate = birthDate;
    if (dto.sireId !== undefined)
      data.sire = dto.sireId
        ? { connect: { id: dto.sireId } }
        : { disconnect: true };
    if (dto.damId !== undefined)
      data.dam = dto.damId
        ? { connect: { id: dto.damId } }
        : { disconnect: true };
    if (dto.fitnessScore !== undefined) data.fitnessScore = dto.fitnessScore;

    const horse = await this.prisma.horse.update({
      where: { id },
      data,
      include: { owner: { select: OWNER_SELECT } },
    });
    return this.toView(horse);
  }

  /** Training Lock (Phase 7) — VET-only, checked by HorseOwnershipGuard on the route. */
  async lock(id: string, dto: LockHorseDto): Promise<HorseView> {
    const existing = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, ownerId: true, locked: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Horse not found');

    const horse = await this.prisma.horse.update({
      where: { id },
      data: {
        locked: dto.locked,
        // Unlocking always clears the reason — no lock-history table in this phase.
        lockReason: dto.locked ? (dto.reason?.trim() ?? null) : null,
      },
      include: { owner: { select: OWNER_SELECT } },
    });

    // Notify (Phase 8) — only when the value actually changed, so repeat
    // calls with the same `locked` don't spam. Shared by the manual VET
    // route (Phase 7) and the auto-lock/unlock triggered by IncidentReport.
    if (existing.locked !== dto.locked) {
      const managerIds = await this.notifications.managerIds();
      const recipients = [existing.ownerId, ...managerIds];
      const message = dto.locked
        ? `${existing.name} đã bị khoá tập luyện${horse.lockReason ? `: ${horse.lockReason}` : ''}`
        : `${existing.name} đã được mở khoá tập luyện`;
      await this.notifications.notifyUsers(
        recipients,
        dto.locked
          ? NotificationType.TRAINING_LOCKED
          : NotificationType.TRAINING_UNLOCKED,
        message,
      );
    }

    return this.toView(horse);
  }

  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Horse not found');
    await this.prisma.horse.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Horse deleted' };
  }

  async setPhoto(id: string, photoPath: string): Promise<HorseView> {
    const current = await this.prisma.horse.findUnique({
      where: { id },
      select: { photoPath: true },
    });
    const horse = await this.prisma.horse.update({
      where: { id },
      data: { photoPath },
      include: { owner: { select: OWNER_SELECT } },
    });
    if (current?.photoPath && current.photoPath !== photoPath) {
      this.storage.removeQuietly(current.photoPath);
    }
    return this.toView(horse);
  }

  /** Shared by `aiInsight` (on-demand) and `checkRiskAndNotify` (background). */
  private async gatherInsightInput(
    id: string,
  ): Promise<Parameters<AiService['analyzeHorse']>[0] | null> {
    const horse = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      select: {
        name: true,
        gender: true,
        breed: true,
        birthDate: true,
        status: true,
        healthStatus: true,
        fitnessScore: true,
        locked: true,
        lockReason: true,
      },
    });
    if (!horse) return null;

    const [
      healthRecords,
      incidents,
      vaccinations,
      sessions,
      raceEntries,
      feedingRecords,
    ] = await this.prisma.$transaction([
      this.prisma.healthRecord.findMany({
        where: { horseId: id },
        select: { examDate: true, diagnosis: true, treatment: true },
        orderBy: { examDate: 'desc' },
        take: 10,
      }),
      this.prisma.incidentReport.findMany({
        where: { horseId: id },
        select: {
          createdAt: true,
          description: true,
          severity: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.vaccination.findMany({
        where: { horseId: id },
        select: { date: true, vaccineName: true, nextDueDate: true },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.trainingSession.findMany({
        where: { horseId: id },
        select: {
          scheduledAt: true,
          type: true,
          status: true,
          resultMetric: true,
          resultValue: true,
        },
        orderBy: { scheduledAt: 'desc' },
        take: 15,
      }),
      this.prisma.raceEntry.findMany({
        where: { horseId: id },
        select: {
          position: true,
          time: true,
          race: { select: { name: true, date: true, distance: true } },
        },
        orderBy: { race: { date: 'desc' } },
        take: 10,
      }),
      this.prisma.feedingRecord.findMany({
        where: { horseId: id },
        select: { date: true, feedType: true, quantityKg: true, notes: true },
        orderBy: { date: 'desc' },
        take: 15,
      }),
    ]);

    return {
      horse,
      healthRecords,
      incidents,
      vaccinations,
      sessions,
      raceEntries: raceEntries.map((r) => ({
        raceDate: r.race.date,
        raceName: r.race.name,
        distance: r.race.distance,
        position: r.position,
        time: r.time,
      })),
      feedingRecords,
    };
  }

  /**
   * AI-generated health/injury-risk summary (VET/MANAGER only, checked by
   * @Roles on the route). Pulls recent health/incident/vaccination/training/
   * race history and calls Groq live — no caching, no persistence (demo-scoped).
   */
  async aiInsight(id: string): Promise<HorseInsightResult> {
    const input = await this.gatherInsightInput(id);
    if (!input) throw new AppException('NOT_FOUND', 'Horse not found');
    return this.ai.analyzeHorse(input);
  }

  /**
   * AI-generated feeding plan suggestion (VET/MANAGER/GROOM — GROOM is who
   * actually feeds the horse). Reuses the same gathered data as aiInsight
   * (feeding history + training intensity + health) so the suggestion stays
   * continuous with what the horse is already eating.
   */
  async feedingSuggestion(id: string): Promise<FeedingSuggestionResult> {
    const input = await this.gatherInsightInput(id);
    if (!input) throw new AppException('NOT_FOUND', 'Horse not found');
    return this.ai.suggestFeedingPlan(input);
  }

  /**
   * Proactive risk check — fired in the background after a VET logs a new
   * incident or health record (see IncidentsService/HealthRecordsService).
   * Never throws: a failed/unconfigured AI call must not break the write
   * that triggered it. Only notifies MANAGER + owner when risk is HIGH, so
   * routine/low-risk entries don't spam notifications.
   */
  async checkRiskAndNotify(id: string): Promise<void> {
    try {
      const input = await this.gatherInsightInput(id);
      if (!input) return;
      const insight = await this.ai.analyzeHorse(input);
      if (insight.riskLevel !== 'HIGH') return;

      const horse = await this.prisma.horse.findFirst({
        where: { id, deletedAt: null },
        select: { name: true, ownerId: true },
      });
      if (!horse) return;

      const managerIds = await this.notifications.managerIds();
      await this.notifications.notifyUsers(
        [horse.ownerId, ...managerIds],
        NotificationType.AI_RISK_ALERT,
        `⚠ AI phát hiện rủi ro sức khỏe CAO cho ${horse.name}: ${insight.summary}`,
      );
    } catch (err) {
      this.logger.warn(
        `checkRiskAndNotify(${id}) failed, skipping: ${(err as Error).message}`,
      );
    }
  }

  async findByPhotoPath(photoPath: string): Promise<Horse | null> {
    return this.prisma.horse.findFirst({
      where: { photoPath, deletedAt: null },
    });
  }

  /**
   * Pedigree tree capped at 3 generations (horse → parents → grandparents).
   * Ownership is checked by HorseOwnershipGuard on the route before this runs.
   */
  async pedigree(id: string): Promise<PedigreeNode> {
    const horse = await this.prisma.horse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, fitnessScore: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    return this.pedigreeNode(
      horse.id,
      horse.name,
      horse.fitnessScore,
      3,
      new Set(),
    );
  }

  private async pedigreeNode(
    id: string,
    name: string,
    fitnessScore: number | null,
    depthLeft: number,
    seen: Set<string>,
  ): Promise<PedigreeNode> {
    seen.add(id);
    if (depthLeft <= 1) {
      return { id, name, fitnessScore, sire: null, dam: null };
    }
    const row = await this.prisma.horse.findUnique({
      where: { id },
      select: {
        sire: { select: { id: true, name: true, fitnessScore: true } },
        dam: { select: { id: true, name: true, fitnessScore: true } },
      },
    });
    const sire =
      row?.sire && !seen.has(row.sire.id)
        ? await this.pedigreeNode(
            row.sire.id,
            row.sire.name,
            row.sire.fitnessScore,
            depthLeft - 1,
            seen,
          )
        : null;
    const dam =
      row?.dam && !seen.has(row.dam.id)
        ? await this.pedigreeNode(
            row.dam.id,
            row.dam.name,
            row.dam.fitnessScore,
            depthLeft - 1,
            seen,
          )
        : null;
    return { id, name, fitnessScore, sire, dam };
  }
}

export interface PedigreeNode {
  id: string;
  name: string;
  fitnessScore: number | null;
  sire: PedigreeNode | null;
  dam: PedigreeNode | null;
}
