import { Injectable } from '@nestjs/common';
import {
  HealthStatus,
  HorseStatus,
  NotificationType,
  Prisma,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateSessionDto,
  CreateTrainingPlanDto,
  ListSessionsQueryDto,
  ListTrainingPlansQueryDto,
  UpdateSessionDto,
  UpdateTrainingPlanDto,
} from './dto/training.dto';

// Phase 9 — training safety rules (Sprint 2 remainder, see
// docs/specs/phase-9-training-safety.md §5 for why these are fixed
// constants rather than a `duration` field / env config.
const SESSION_CONFLICT_WINDOW_MIN = 60;

// Times in user-facing messages read in the club's own timezone.
const VN_DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const formatVnDateTime = (d: Date) => VN_DATE_TIME.format(d);
const FITNESS_HEART_RATE_MAX = 195;
const FITNESS_METRIC_KEY = 'heart_rate_max';

const PLAN_INCLUDE = {
  trainer: { select: { id: true, name: true, email: true } },
  horse: { select: { id: true, name: true, breed: true, ownerId: true } },
} satisfies Prisma.TrainingPlanInclude;

type PlanView = Prisma.TrainingPlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

const SESSION_INCLUDE = {
  groom: { select: { id: true, name: true } },
  trainer: { select: { id: true, name: true, email: true } },
  horse: { select: { id: true, name: true, ownerId: true } },
} satisfies Prisma.TrainingSessionInclude;

type SessionView = Prisma.TrainingSessionGetPayload<{
  include: typeof SESSION_INCLUDE;
}>;

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

const GROOM_ALLOWED_FIELDS = new Set(['status', 'resultMetric', 'resultValue']);
const TERMINAL: SessionStatus[] = [
  SessionStatus.DONE,
  SessionStatus.CANCELLED,
  SessionStatus.MISSED,
];

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  /**
   * EX-01 — reject a session time if the horse already has a PLANNED one
   * within SESSION_CONFLICT_WINDOW_MIN minutes either side. Checked when a
   * session is created and when a planned one is moved to a new time
   * (`excludeId` = the session being moved, so it never clashes with itself).
   */
  private async assertNoScheduleConflict(
    horseId: string,
    scheduledAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const windowMs = SESSION_CONFLICT_WINDOW_MIN * 60_000;
    const conflict = await this.prisma.trainingSession.findFirst({
      where: {
        horseId,
        status: SessionStatus.PLANNED,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - windowMs),
          lte: new Date(scheduledAt.getTime() + windowMs),
        },
      },
      orderBy: { scheduledAt: 'asc' },
      select: { scheduledAt: true, type: true },
    });
    if (conflict) {
      throw new AppException(
        'CONFLICT',
        `Ngựa đã có buổi tập "${conflict.type}" lúc ${formatVnDateTime(conflict.scheduledAt)} — hai buổi tập phải cách nhau ít nhất ${SESSION_CONFLICT_WINDOW_MIN} phút.`,
      );
    }
  }

  /**
   * UC-12 (Phase 9) — fires only for the fixed metric key
   * FITNESS_METRIC_KEY; other resultMetric values are free text and not
   * evaluated. Notifies the session's trainer, every active groom, and
   * the horse's owner. Never throws — a notification failure must not
   * block the result write that already succeeded.
   */
  private async maybeWarnFitness(session: SessionView): Promise<void> {
    if (
      session.resultMetric !== FITNESS_METRIC_KEY ||
      session.resultValue === null ||
      session.resultValue <= FITNESS_HEART_RATE_MAX
    ) {
      return;
    }
    const groomIds = await this.notifications.groomIds();
    const recipients = [session.trainerId, ...groomIds, session.horse.ownerId];
    await this.notifications.notifyUsers(
      recipients,
      NotificationType.FITNESS_WARNING,
      `${session.horse.name} ghi nhận ${FITNESS_METRIC_KEY}=${session.resultValue} (>${FITNESS_HEART_RATE_MAX}) ở buổi tập ${session.type} lúc ${formatVnDateTime(session.scheduledAt)}`,
    );
  }

  async create(
    horseId: string,
    dto: CreateSessionDto,
    trainer: AuthUser,
  ): Promise<SessionView> {
    // Route guard already 404s a missing horse, but keep the service honest.
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { ownerId: true, locked: true, lockReason: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    // Training Lock (Phase 7) — VET-issued, blocks new sessions only.
    if (horse.locked) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Horse training is locked${horse.lockReason ? `: ${horse.lockReason}` : ''}`,
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);
    this.assertFuture(scheduledAt);
    await this.assertPlanWindow(horseId, dto.planId, scheduledAt);
    await this.assertGroom(dto.groomId);
    await this.reconcileMissed(new Date(), horseId);

    await this.assertNoScheduleConflict(horseId, new Date(dto.scheduledAt));

    return this.prisma.trainingSession.create({
      data: {
        horseId,
        trainerId: trainer.id,
        groomId: dto.groomId ?? null,
        planId: dto.planId ?? null,
        scheduledAt: new Date(dto.scheduledAt),
        type: dto.type.trim(),
        notes: dto.notes?.trim() ?? null,
      },
      include: SESSION_INCLUDE,
    });
  }

  async listByHorse(
    horseId: string,
    q: ListSessionsQueryDto,
  ): Promise<Paginated<SessionView>> {
    await this.reconcileMissed(new Date(), horseId);
    const scheduledAt: Prisma.DateTimeFilter = {};
    if (q.from) scheduledAt.gte = new Date(q.from);
    if (q.to) scheduledAt.lte = new Date(q.to);

    const where: Prisma.TrainingSessionWhereInput = {
      horseId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to ? { scheduledAt } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainingSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.trainingSession.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async get(id: string, user: AuthUser): Promise<SessionView> {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new AppException('NOT_FOUND', 'Session not found');
    this.assertHorseVisible(session.horse, user);
    await this.reconcileMissed(new Date(), session.horseId);
    return this.prisma.trainingSession.findUniqueOrThrow({
      where: { id },
      include: SESSION_INCLUDE,
    });
  }

  async update(
    id: string,
    dto: UpdateSessionDto,
    user: AuthUser,
  ): Promise<SessionView> {
    // class-transformer may materialise unset optional props as `undefined`,
    // so look only at fields the caller actually sent.
    const sentFields = Object.entries(dto)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    if (sentFields.length === 0) {
      throw new AppException('VALIDATION_ERROR', 'No fields to update');
    }
    if (
      user.role === Role.GROOM &&
      !sentFields.every((k) => GROOM_ALLOWED_FIELDS.has(k))
    ) {
      throw new AppException(
        'FORBIDDEN',
        'A groom may only change status and result fields',
      );
    }

    await this.reconcileMissed(new Date(), undefined, id);
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: { horse: { select: { ownerId: true } } },
    });
    if (!session) throw new AppException('NOT_FOUND', 'Session not found');

    if (TERMINAL.includes(session.status)) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Session is already ${session.status}`,
      );
    }

    const nonStatusFields =
      dto.scheduledAt !== undefined ||
      dto.type !== undefined ||
      dto.notes !== undefined;
    if (nonStatusFields && session.status !== SessionStatus.PLANNED) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Only a planned session can be edited',
      );
    }

    if (dto.status === SessionStatus.MISSED) {
      throw new AppException(
        'VALIDATION_ERROR',
        'MISSED is assigned automatically',
      );
    }
    const scheduledAt =
      dto.scheduledAt !== undefined
        ? new Date(dto.scheduledAt)
        : session.scheduledAt;
    if (dto.scheduledAt !== undefined) this.assertFuture(scheduledAt);
    if (dto.scheduledAt !== undefined || dto.planId !== undefined) {
      await this.assertPlanWindow(
        session.horseId,
        dto.planId !== undefined ? dto.planId : session.planId,
        scheduledAt,
      );
    }
    await this.assertGroom(dto.groomId);
    const data: Prisma.TrainingSessionUncheckedUpdateManyInput = {};
    if (dto.groomId !== undefined) data.groomId = dto.groomId;
    if (dto.planId !== undefined) data.planId = dto.planId;
    if (dto.scheduledAt !== undefined)
      data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.type !== undefined) data.type = dto.type.trim();
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
    if (dto.resultMetric !== undefined)
      data.resultMetric = dto.resultMetric.trim();
    if (dto.resultValue !== undefined) data.resultValue = dto.resultValue;
    if (dto.status !== undefined) data.status = dto.status;

    // EX-01 — moving a planned session must not land it on top of another.
    // Skipped when the same request closes the session (DONE/CANCELLED),
    // since only PLANNED sessions take part in the conflict rule.
    const staysPlanned =
      dto.status === undefined || dto.status === SessionStatus.PLANNED;
    if (dto.scheduledAt !== undefined && staysPlanned) {
      await this.assertNoScheduleConflict(
        session.horseId,
        new Date(dto.scheduledAt),
        session.id,
      );
    }

    if (dto.status === SessionStatus.DONE) {
      const metric = dto.resultMetric ?? session.resultMetric;
      const value =
        dto.resultValue !== undefined ? dto.resultValue : session.resultValue;
      if (!metric || value === null || value === undefined) {
        throw new AppException(
          'VALIDATION_ERROR',
          'resultMetric and resultValue are required to mark a session DONE',
        );
      }
    }

    // Do not reopen a session closed by a concurrent request or the overdue job.
    const changed = await this.prisma.trainingSession.updateMany({
      where: {
        id,
        status: SessionStatus.PLANNED,
        scheduledAt: { gte: new Date() },
      },
      data,
    });
    if (changed.count !== 1) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Only a planned session can be edited',
      );
    }
    const updated = await this.prisma.trainingSession.findUniqueOrThrow({
      where: { id },
      include: SESSION_INCLUDE,
    });

    if (dto.status === SessionStatus.DONE) {
      await this.maybeWarnFitness(updated);
    }

    return updated;
  }

  private clubDay(date: Date): string {
    return new Date(date.getTime() + 7 * 60 * 60_000)
      .toISOString()
      .slice(0, 10);
  }

  private assertFuture(at: Date): void {
    if (!Number.isFinite(at.getTime()) || at.getTime() < Date.now()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Session time cannot be in the past',
      );
    }
  }

  private async assertPlanWindow(
    horseId: string,
    planId: string | null | undefined,
    at: Date,
  ) {
    if (!planId) return;
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || plan.horseId !== horseId) {
      throw new AppException(
        'VALIDATION_ERROR',
        'planId must reference a training plan for this horse',
      );
    }
    const day = this.clubDay(at);
    if (
      day < this.clubDay(plan.startDate) ||
      (plan.endDate && day > this.clubDay(plan.endDate))
    ) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Session time must fall within the training plan dates',
      );
    }
  }

  private async assertGroom(id: string | null | undefined) {
    if (!id) return;
    const groom = await this.prisma.user.findFirst({
      where: {
        id,
        role: Role.GROOM,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!groom)
      throw new AppException(
        'VALIDATION_ERROR',
        'Assigned groom must be an active GROOM',
      );
  }

  async listGrooms(q: ListTrainingPlansQueryDto) {
    const where = {
      role: Role.GROOM,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  reconcileMissed(now = new Date(), horseId?: string, id?: string) {
    return this.prisma.trainingSession.updateMany({
      where: {
        status: SessionStatus.PLANNED,
        scheduledAt: { lt: now },
        ...(horseId ? { horseId } : {}),
        ...(id ? { id } : {}),
      },
      data: { status: SessionStatus.MISSED },
    });
  }

  async overview(user: AuthUser, now = new Date()) {
    if (user.role !== Role.MANAGER && user.role !== Role.TRAINER) {
      throw new AppException('FORBIDDEN', 'Insufficient role');
    }
    await this.reconcileMissed(now);
    // Monday buckets in club time: current week plus seven prior weeks.
    const club = new Date(now.getTime() + 7 * 60 * 60_000);
    club.setUTCHours(0, 0, 0, 0);
    club.setUTCDate(club.getUTCDate() - ((club.getUTCDay() + 6) % 7) - 49);
    const start = new Date(club.getTime() - 7 * 60 * 60_000);
    const end = new Date(start.getTime() + 56 * 86400000);
    const groupsQuery = this.prisma.trainingSession.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      where: { horse: { deletedAt: null } },
      _count: { _all: true },
    });
    const [groups, trend] = await this.prisma.$transaction([
      groupsQuery,
      this.prisma.$queryRaw<
        { week: Date; status: SessionStatus; count: bigint }[]
      >`
        SELECT date_trunc('week', s."scheduledAt" + interval '7 hours') AS week,
               s.status, COUNT(*) AS count
        FROM "TrainingSession" s JOIN "Horse" h ON h.id = s."horseId"
        WHERE h."deletedAt" IS NULL AND s."scheduledAt" >= ${start} AND s."scheduledAt" < ${end}
        GROUP BY week, s.status ORDER BY week
      `,
    ]);
    const counts = { PLANNED: 0, DONE: 0, CANCELLED: 0, MISSED: 0 };
    for (const group of groups) counts[group.status] = group._count._all;
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const week = new Date(club.getTime() + i * 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const bucket = { week, PLANNED: 0, DONE: 0, CANCELLED: 0, MISSED: 0 };
      for (const row of trend)
        if (row.week.toISOString().slice(0, 10) === week)
          bucket[row.status] = Number(row.count);
      return bucket;
    });
    const decided = counts.DONE + counts.CANCELLED;
    return {
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      completion: decided ? Math.round((counts.DONE / decided) * 100) : null,
      weeks,
    };
  }

  // --- Training plans (Phase 7) ---

  private assertPlanDates(
    startDate: Date,
    endDate: Date | null | undefined,
  ): void {
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'endDate cannot be before startDate',
      );
    }
  }

  async createPlan(
    horseId: string,
    dto: CreateTrainingPlanDto,
    trainer: AuthUser,
  ): Promise<PlanView> {
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        healthStatus: true,
        locked: true,
      },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    // BR-1: Cannot create training plan for a retired horse — no point in
    // planning training for a horse that will never compete again.
    if (horse.status === HorseStatus.RETIRED) {
      throw new AppException(
        'VALIDATION_ERROR',
        `${horse.name} đã giải nghệ (RETIRED), không thể lập giáo án huấn luyện mới.`,
      );
    }

    // BR-2: Cannot create training plan for a quarantined horse — the horse
    // must clear quarantine before any training activity can be planned.
    if (horse.healthStatus === HealthStatus.QUARANTINED) {
      throw new AppException(
        'VALIDATION_ERROR',
        `${horse.name} đang trong trạng thái cách ly (QUARANTINED), cần chờ Bác sĩ thú y cho phép trước khi lập giáo án.`,
      );
    }

    // Note: locked horses (Training Lock) are allowed to have plans created —
    // a plan is a strategic document, not an active session. The lock only
    // prevents scheduling concrete training sessions (see createSession).

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    this.assertPlanDates(startDate, endDate);

    return this.prisma.trainingPlan.create({
      data: {
        horseId,
        trainerId: trainer.id,
        goal: dto.goal.trim(),
        startDate,
        endDate,
      },
      include: PLAN_INCLUDE,
    });
  }

  async listPlansByHorse(
    horseId: string,
    q: ListTrainingPlansQueryDto,
  ): Promise<Paginated<PlanView>> {
    const where: Prisma.TrainingPlanWhereInput = { horseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainingPlan.findMany({
        where,
        include: PLAN_INCLUDE,
        orderBy: { startDate: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.trainingPlan.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async listAllPlans(
    q: ListTrainingPlansQueryDto,
    user: AuthUser,
  ): Promise<Paginated<PlanView>> {
    const where: Prisma.TrainingPlanWhereInput = {
      horse: {
        deletedAt: null,
        ...(user.role === Role.OWNER ? { ownerId: user.id } : {}),
      },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainingPlan.findMany({
        where,
        include: PLAN_INCLUDE,
        orderBy: { startDate: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.trainingPlan.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async getPlan(id: string, user: AuthUser) {
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id },
      include: {
        ...PLAN_INCLUDE,
        sessions: {
          select: { id: true, scheduledAt: true, type: true, status: true },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
    if (!plan) throw new AppException('NOT_FOUND', 'Training plan not found');
    this.assertHorseVisible(plan.horse, user);
    await this.reconcileMissed(new Date(), plan.horseId);
    return {
      ...plan,
      sessions: await this.prisma.trainingSession.findMany({
        where: { planId: id },
        select: { id: true, scheduledAt: true, type: true, status: true },
        orderBy: { scheduledAt: 'asc' },
      }),
    };
  }

  async updatePlan(id: string, dto: UpdateTrainingPlanDto): Promise<PlanView> {
    const existing = await this.prisma.trainingPlan.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    });
    if (!existing)
      throw new AppException('NOT_FOUND', 'Training plan not found');

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : existing.endDate;
    this.assertPlanDates(startDate, endDate);

    const data: Prisma.TrainingPlanUpdateInput = {};
    if (dto.goal !== undefined) data.goal = dto.goal.trim();
    if (dto.startDate !== undefined) data.startDate = startDate;
    if (dto.endDate !== undefined) data.endDate = endDate;

    return this.prisma.trainingPlan.update({
      where: { id },
      data,
      include: PLAN_INCLUDE,
    });
  }
}
