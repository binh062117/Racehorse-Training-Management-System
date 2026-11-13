import { Injectable } from '@nestjs/common';
import {
  DailyCareTask,
  HorseStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import {
  careDay,
  careDayFromString,
  formatCareDay,
  nextCareDay,
} from './care-day';
import {
  CreateDailyCareDto,
  GenerateDailyChecklistDto,
  ListDailyCareQueryDto,
  UpdateDailyCareDto,
} from './dto/daily-care.dto';

const GROOM_SELECT = { id: true, name: true, email: true } as const;
const HORSE_SELECT = { id: true, name: true, ownerId: true } as const;

const CARE_INCLUDE = {
  groom: { select: GROOM_SELECT },
  horse: { select: HORSE_SELECT },
} as const;

export type DailyCareView = Prisma.DailyCareLogGetPayload<{
  include: typeof CARE_INCLUDE;
}>;

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

const DEFAULT_TASKS: DailyCareTask[] = [
  DailyCareTask.FEEDING,
  DailyCareTask.CLEANING,
  DailyCareTask.BATHING,
  DailyCareTask.ICE_SOAK,
  DailyCareTask.HEALTH_CHECK,
];

@Injectable()
export class DailyCareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Closes every checklist from before today (Vietnam time): managers hear
   * about the tasks left undone, then the old rows are deleted so a new day
   * starts empty until a groom generates its checklist. Idempotent — a run
   * that finds nothing (or loses the race to delete) sends nothing.
   */
  async closePastDays(now: Date = new Date()): Promise<number> {
    const today = careDay(now);
    const old = await this.prisma.dailyCareLog.findMany({
      where: { date: { lt: today } },
      select: {
        id: true,
        date: true,
        completed: true,
        horse: { select: { name: true } },
      },
    });
    if (old.length === 0) return 0;
    const { count } = await this.prisma.dailyCareLog.deleteMany({
      where: { id: { in: old.map((o) => o.id) } },
    });
    if (count === 0) return 0;

    // Only recent days are worth a notification; older leftovers go quietly.
    const notifyFrom = today.getTime() - 2 * 24 * 3600_000;
    const days = new Map<
      number,
      { total: number; pending: Map<string, number> }
    >();
    for (const o of old) {
      const day = careDay(o.date).getTime();
      const entry = days.get(day) ?? { total: 0, pending: new Map() };
      entry.total += 1;
      if (!o.completed) {
        entry.pending.set(
          o.horse.name,
          (entry.pending.get(o.horse.name) ?? 0) + 1,
        );
      }
      days.set(day, entry);
    }
    const managerIds = await this.notifications.managerIds();
    for (const [day, { total, pending }] of [...days].sort(
      (a, b) => a[0] - b[0],
    )) {
      const undone = [...pending.values()].reduce((a, b) => a + b, 0);
      if (undone === 0 || day < notifyFrom) continue;
      const horses = [...pending]
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name} (${n})`)
        .join(', ');
      await this.notifications.notifyUsers(
        managerIds,
        NotificationType.DAILY_CARE_INCOMPLETE,
        `Checklist chăm sóc ngày ${formatCareDay(new Date(day))} chưa hoàn thành: còn ${undone}/${total} việc — ${horses}`,
      );
    }
    await this.audit.record({
      action: 'DAILY_CARE_CLOSE',
      entity: 'DAILY_CARE',
      description: `Đóng checklist chăm sóc các ngày trước ${formatCareDay(today)}: xóa ${count} việc`,
      diff: { deleted: count, before: today.toISOString() },
    });
    return count;
  }

  async list(
    q: ListDailyCareQueryDto,
    currentUser: AuthUser,
  ): Promise<Paginated<DailyCareView>> {
    const where: Prisma.DailyCareLogWhereInput = {
      ...(q.horseId ? { horseId: q.horseId } : {}),
      ...(q.groomId ? { groomId: q.groomId } : {}),
      ...(q.taskType ? { taskType: q.taskType } : {}),
      ...(q.completed !== undefined ? { completed: q.completed } : {}),
    };

    await this.closePastDays();
    if (q.date) {
      const start = careDayFromString(q.date);
      where.date = { gte: start, lt: nextCareDay(start) };
    }

    // Owner can only see care logs for their horses
    if (currentUser.role === Role.OWNER) {
      where.horse = { ownerId: currentUser.id };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.dailyCareLog.findMany({
        where,
        include: CARE_INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.dailyCareLog.count({ where }),
    ]);

    return {
      data,
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  async create(
    dto: CreateDailyCareDto,
    groomId: string,
  ): Promise<DailyCareView> {
    const horse = await this.prisma.horse.findFirst({
      where: { id: dto.horseId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    const day = dto.date ? careDayFromString(dto.date) : careDay();
    if (day.getTime() !== careDay().getTime()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Chỉ thêm việc chăm sóc cho hôm nay.',
      );
    }

    const care = await this.prisma.dailyCareLog.create({
      data: {
        horseId: dto.horseId,
        groomId,
        date: day,
        taskType: dto.taskType,
        notes: dto.notes?.trim() ?? null,
      },
      include: CARE_INCLUDE,
    });

    await this.audit.record({
      actorId: groomId,
      action: 'DAILY_CARE_CREATE',
      entity: 'DAILY_CARE',
      entityId: care.id,
      description: `Tạo công việc chăm sóc ${dto.taskType} cho ngựa "${horse.name}"`,
      diff: { taskType: dto.taskType, horseId: dto.horseId },
    });

    return care;
  }

  async generateChecklist(
    dto: GenerateDailyChecklistDto,
    groomId: string,
  ): Promise<{ createdCount: number }> {
    // A checklist is only ever made for today; yesterday's is closed first.
    const targetDate = careDay();
    if (
      dto.date &&
      careDayFromString(dto.date).getTime() !== targetDate.getTime()
    ) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Chỉ tạo checklist cho hôm nay (${formatCareDay(targetDate)}).`,
      );
    }
    await this.closePastDays();
    const startOfDay = targetDate;
    const endOfDay = nextCareDay(targetDate);

    const horseFilter: Prisma.HorseWhereInput = {
      deletedAt: null,
      status: HorseStatus.ACTIVE,
      ...(dto.horseId ? { id: dto.horseId } : {}),
    };

    const horses = await this.prisma.horse.findMany({
      where: horseFilter,
      select: { id: true, name: true },
    });

    // One read and one bulk insert instead of a round trip per horse and task.
    const existing = await this.prisma.dailyCareLog.findMany({
      where: {
        horseId: { in: horses.map((h) => h.id) },
        date: { gte: startOfDay, lt: endOfDay },
      },
      select: { horseId: true, taskType: true },
    });
    const have = new Set(existing.map((e) => `${e.horseId}:${e.taskType}`));
    const rows: Prisma.DailyCareLogCreateManyInput[] = [];
    for (const h of horses) {
      for (const t of DEFAULT_TASKS) {
        if (!have.has(`${h.id}:${t}`)) {
          rows.push({
            horseId: h.id,
            groomId,
            date: targetDate,
            taskType: t,
            completed: false,
          });
        }
      }
    }
    if (rows.length) await this.prisma.dailyCareLog.createMany({ data: rows });
    const createdCount = rows.length;

    await this.audit.record({
      actorId: groomId,
      action: 'DAILY_CARE_GENERATE',
      entity: 'DAILY_CARE',
      description: `Khởi tạo danh sách công việc chăm sóc hàng ngày (${createdCount} việc)`,
      diff: { createdCount, date: targetDate.toISOString() },
    });

    return { createdCount };
  }

  async toggle(id: string, user: AuthUser): Promise<DailyCareView> {
    const care = await this.prisma.dailyCareLog.findUnique({
      where: { id },
      include: CARE_INCLUDE,
    });
    if (!care) throw new AppException('NOT_FOUND', 'Care log not found');

    const nextCompleted = !care.completed;
    const updated = await this.prisma.dailyCareLog.update({
      where: { id },
      data: {
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date() : null,
        groomId: user.id,
      },
      include: CARE_INCLUDE,
    });

    await this.audit.record({
      actorId: user.id,
      action: nextCompleted ? 'DAILY_CARE_COMPLETE' : 'DAILY_CARE_UNCOMPLETE',
      entity: 'DAILY_CARE',
      entityId: id,
      description: `${user.name} đánh dấu ${nextCompleted ? 'hoàn thành' : 'chưa hoàn thành'} việc ${care.taskType} cho ngựa "${care.horse.name}"`,
      diff: { before: care.completed, after: nextCompleted },
    });

    return updated;
  }

  async update(
    id: string,
    dto: UpdateDailyCareDto,
    user: AuthUser,
  ): Promise<DailyCareView> {
    const care = await this.prisma.dailyCareLog.findUnique({
      where: { id },
    });
    if (!care) throw new AppException('NOT_FOUND', 'Care log not found');

    const updated = await this.prisma.dailyCareLog.update({
      where: { id },
      data: {
        ...(dto.completed !== undefined
          ? {
              completed: dto.completed,
              completedAt: dto.completed ? new Date() : null,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
        groomId: user.id,
      },
      include: CARE_INCLUDE,
    });

    return updated;
  }
}
