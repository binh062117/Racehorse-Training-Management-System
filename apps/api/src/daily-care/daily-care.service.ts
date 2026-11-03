import { Injectable } from '@nestjs/common';
import { DailyCareTask, HorseStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
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
  ) {}

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

    if (q.date) {
      const d = new Date(q.date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.date = { gte: start, lt: end };
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

  async create(dto: CreateDailyCareDto, groomId: string): Promise<DailyCareView> {
    const horse = await this.prisma.horse.findFirst({
      where: { id: dto.horseId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    const care = await this.prisma.dailyCareLog.create({
      data: {
        horseId: dto.horseId,
        groomId,
        date: dto.date ? new Date(dto.date) : new Date(),
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
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate() + 1,
    );

    const horseFilter: Prisma.HorseWhereInput = {
      deletedAt: null,
      status: HorseStatus.ACTIVE,
      ...(dto.horseId ? { id: dto.horseId } : {}),
    };

    const horses = await this.prisma.horse.findMany({
      where: horseFilter,
      select: { id: true, name: true },
    });

    let createdCount = 0;

    for (const h of horses) {
      // Find existing tasks today
      const existing = await this.prisma.dailyCareLog.findMany({
        where: {
          horseId: h.id,
          date: { gte: startOfDay, lt: endOfDay },
        },
        select: { taskType: true },
      });
      const existingTypes = new Set(existing.map((e) => e.taskType));

      for (const t of DEFAULT_TASKS) {
        if (!existingTypes.has(t)) {
          await this.prisma.dailyCareLog.create({
            data: {
              horseId: h.id,
              groomId,
              date: targetDate,
              taskType: t,
              completed: false,
            },
          });
          createdCount++;
        }
      }
    }

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

  async update(id: string, dto: UpdateDailyCareDto, user: AuthUser): Promise<DailyCareView> {
    const care = await this.prisma.dailyCareLog.findUnique({
      where: { id },
    });
    if (!care) throw new AppException('NOT_FOUND', 'Care log not found');

    const updated = await this.prisma.dailyCareLog.update({
      where: { id },
      data: {
        ...(dto.completed !== undefined ? { completed: dto.completed, completedAt: dto.completed ? new Date() : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
        groomId: user.id,
      },
      include: CARE_INCLUDE,
    });

    return updated;
  }
}
