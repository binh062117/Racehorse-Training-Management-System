import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../common/app-exception';
import type { Paginated } from '../horses/horses.service';
import {
  CreateVaccinationDto,
  ListUpcomingVaccinationsQueryDto,
  ListVaccinationsQueryDto,
} from './dto/vaccinations.dto';

// Cửa sổ lịch chăm sóc sắp tới: lấy các bản ghi cần nhắc trong 30 ngày tới.
const UPCOMING_WINDOW_DAYS = 30;
const UPCOMING_HORSE_SELECT = { id: true, name: true } as const;

type UpcomingVaccination = Prisma.VaccinationGetPayload<{
  include: { horse: { select: typeof UPCOMING_HORSE_SELECT } };
}>;

@Injectable()
export class VaccinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(horseId: string, dto: CreateVaccinationDto) {
    // Kiểm tra ngựa có tồn tại và chưa bị xóa mềm; nếu không có thì trả lỗi ngay để tránh tạo lịch sai.
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true, name: true, ownerId: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    const created = await this.prisma.vaccination.create({
      data: {
        horseId,
        careType: dto.careType ?? 'VACCINATION',
        vaccineName: dto.vaccineName.trim(),
        date: new Date(dto.date),
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
    });

    // Check if nextDueDate is upcoming soon (within 7 days) and notify immediately
    if (created.nextDueDate) {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 86_400_000);
      if (created.nextDueDate >= now && created.nextDueDate <= in7Days) {
        const typeLabel =
          created.careType === 'DEWORMING' ? 'Tẩy giun' : 'Tiêm vắc-xin';
        const formattedDate = created.nextDueDate.toLocaleDateString('vi-VN');
        const [vetIds, managerIds] = await Promise.all([
          this.notifications.vetIds(),
          this.notifications.managerIds(),
        ]);
        await this.notifications.notifyUsers(
          [horse.ownerId, ...vetIds, ...managerIds],
          NotificationType.PREVENTIVE_CARE_DUE,
          `Lịch phòng ngừa sắp tới: ${horse.name} cần ${typeLabel} (${created.vaccineName}) vào ngày ${formattedDate}`,
        );
      }
    }

    return created;
  }

  async checkDueAndNotify(): Promise<{ notifiedCount: number }> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);

    const upcoming = await this.prisma.vaccination.findMany({
      where: {
        nextDueDate: { gte: now, lte: in7Days },
      },
      include: {
        horse: { select: { id: true, name: true, ownerId: true } },
      },
    });

    const [vetIds, managerIds] = await Promise.all([
      this.notifications.vetIds(),
      this.notifications.managerIds(),
    ]);

    let notifiedCount = 0;
    for (const item of upcoming) {
      const typeLabel =
        item.careType === 'DEWORMING' ? 'Tẩy giun' : 'Tiêm vắc-xin';
      const formattedDate = item.nextDueDate?.toLocaleDateString('vi-VN');
      const message = `Lịch phòng ngừa sắp tới: ${item.horse.name} cần ${typeLabel} (${item.vaccineName}) trước ngày ${formattedDate}`;

      const recentNotif = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.PREVENTIVE_CARE_DUE,
          message,
          createdAt: { gte: new Date(now.getTime() - 3 * 86_400_000) },
        },
      });

      if (!recentNotif) {
        const recipients = [item.horse.ownerId, ...vetIds, ...managerIds];
        await this.notifications.notifyUsers(
          recipients,
          NotificationType.PREVENTIVE_CARE_DUE,
          message,
        );
        notifiedCount++;
      }
    }

    return { notifiedCount };
  }

  async listByHorse(horseId: string, q: ListVaccinationsQueryDto) {
    const where: Prisma.VaccinationWhereInput = { horseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vaccination.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  /** Club-wide view (UC-18) — no per-horse ownership; OWNER is blocked at the route. */
  async listUpcoming(
    q: ListUpcomingVaccinationsQueryDto,
  ): Promise<Paginated<UpcomingVaccination>> {
    const where: Prisma.VaccinationWhereInput = q.careType
      ? { careType: q.careType }
      : {};
    if (q.upcoming) {
      const now = new Date();
      const until = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000);
      where.nextDueDate = { gte: now, lte: until };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vaccination.findMany({
        where,
        include: { horse: { select: UPCOMING_HORSE_SELECT } },
        orderBy: { nextDueDate: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }
}
