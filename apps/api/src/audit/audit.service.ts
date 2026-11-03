import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import { ListAuditLogsQueryDto } from './dto/audit.dto';

export interface RecordAuditParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  diff?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogView {
  id: string;
  actorId: string | null;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string | null;
  } | null;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  diff: Prisma.JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  authEventsToday: number;
  uniqueActorsCount: number;
  topActions: { action: string; count: number }[];
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Safe audit log recorder. Never throws or fails the parent business transaction.
   */
  async record(params: RecordAuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          description: params.description,
          diff: params.diff ?? Prisma.JsonNull,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record audit log for action ${params.action}: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }

  async list(q: ListAuditLogsQueryDto): Promise<{
    data: AuditLogView[];
    meta: { page: number; limit: number; total: number };
  }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.entity ? { entity: { equals: q.entity, mode: 'insensitive' } } : {}),
      ...(q.action ? { action: { equals: q.action, mode: 'insensitive' } } : {}),
      ...(q.startDate || q.endDate
        ? {
            createdAt: {
              ...(q.startDate ? { gte: new Date(q.startDate) } : {}),
              ...(q.endDate ? { lte: new Date(q.endDate) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { description: { contains: q.search, mode: 'insensitive' } },
              { action: { contains: q.search, mode: 'insensitive' } },
              { entityId: { contains: q.search, mode: 'insensitive' } },
              {
                actor: {
                  OR: [
                    { name: { contains: q.search, mode: 'insensitive' } },
                    { email: { contains: q.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
      },
    };
  }

  async get(id: string): Promise<AuditLogView> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!log) {
      throw new AppException('NOT_FOUND', 'Audit log not found');
    }

    return log;
  }

  async getStats(): Promise<AuditStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalLogs, todayLogs, authEventsToday, distinctActors, actionsGroup] =
      await Promise.all([
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        this.prisma.auditLog.count({
          where: {
            entity: 'AUTH',
            createdAt: { gte: startOfToday },
          },
        }),
        this.prisma.auditLog.findMany({
          distinct: ['actorId'],
          where: { actorId: { not: null } },
          select: { actorId: true },
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 5,
        }),
      ]);

    return {
      totalLogs,
      todayLogs,
      authEventsToday,
      uniqueActorsCount: distinctActors.length,
      topActions: actionsGroup.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
    };
  }
}
