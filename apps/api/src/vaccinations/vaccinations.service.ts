import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

// Tạo / list lịch phòng ngừa theo kiểu careType (VACCINATION / DEWORMING).
// Mục tiêu là tách rõ 2 loại lịch chăm sóc nhưng vẫn dùng chung 1 model Vaccination.

type UpcomingVaccination = Prisma.VaccinationGetPayload<{
  include: { horse: { select: typeof UPCOMING_HORSE_SELECT } };
}>;

@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(horseId: string, dto: CreateVaccinationDto) {
    // Kiểm tra ngựa có tồn tại và chưa bị xóa mềm; nếu không có thì trả lỗi ngay để tránh tạo lịch sai.
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    return this.prisma.vaccination.create({
      data: {
        horseId,
        careType: dto.careType ?? 'VACCINATION',
        vaccineName: dto.vaccineName.trim(),
        date: new Date(dto.date),
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
    });
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
        orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }
}
