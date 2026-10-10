import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { Paginated } from '../horses/horses.service';
import { ListNotificationsQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal helper — used by HorsesService.lock() (Phase 7/8) and
   * IncidentsService (Phase 8). Not exposed as its own route.
   */
  async notifyUsers(
    userIds: string[],
    type: NotificationType,
    message: string,
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    await this.prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, type, message })),
    });
  }

  /** All ACTIVE, non-deleted MANAGER user ids — recipients for lock/incident alerts. */
  async managerIds(): Promise<string[]> {
    const managers = await this.prisma.user.findMany({
      where: { role: 'MANAGER', status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return managers.map((m) => m.id);
  }

  /**
   * All ACTIVE, non-deleted GROOM user ids — recipients for the fitness
   * threshold warning (Phase 9). Sessions have no per-horse groom
   * assignment in the schema, so "relevant GROOM" means every active
   * groom, same pattern as managerIds().
   */
  async groomIds(): Promise<string[]> {
    const grooms = await this.prisma.user.findMany({
      where: { role: 'GROOM', status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return grooms.map((g) => g.id);
  }

  async list(
    q: ListNotificationsQueryDto,
    currentUser: AuthUser,
  ): Promise<Paginated<Prisma.NotificationGetPayload<object>>> {
    const where: Prisma.NotificationWhereInput = { userId: currentUser.id };
    // unread=true -> only unread; unread=false -> only read; omitted -> all.
    if (q.unread !== undefined) where.read = !q.unread;
    if (q.type !== undefined) where.type = q.type;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data: rows, meta: { page: q.page, limit: q.limit, total } };
  }

  async markRead(id: string, currentUser: AuthUser) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing)
      throw new AppException('NOT_FOUND', 'Notification not found');
    if (existing.userId !== currentUser.id) {
      throw new AppException(
        'FORBIDDEN',
        'This notification belongs to another user',
      );
    }
    if (existing.read) return existing;
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async remove(
    id: string,
    currentUser: AuthUser,
  ): Promise<{ message: string }> {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing)
      throw new AppException('NOT_FOUND', 'Notification not found');
    if (existing.userId !== currentUser.id) {
      throw new AppException(
        'FORBIDDEN',
        'This notification belongs to another user',
      );
    }
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }
}
