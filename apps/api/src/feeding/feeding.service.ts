import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateFeedingRecordDto,
  ListFeedingRecordsQueryDto,
} from './dto/feeding.dto';

const RECORDED_BY_SELECT = { id: true, name: true, email: true } as const;

@Injectable()
export class FeedingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    horseId: string,
    dto: CreateFeedingRecordDto,
    recordedBy: AuthUser,
  ) {
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    return this.prisma.feedingRecord.create({
      data: {
        horseId,
        recordedById: recordedBy.id,
        feedType: dto.feedType.trim(),
        quantityKg: dto.quantityKg,
        date: new Date(dto.date),
        notes: dto.notes?.trim() || null,
      },
      include: { recordedBy: { select: RECORDED_BY_SELECT } },
    });
  }

  async listByHorse(horseId: string, q: ListFeedingRecordsQueryDto) {
    const where: Prisma.FeedingRecordWhereInput = { horseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.feedingRecord.findMany({
        where,
        include: { recordedBy: { select: RECORDED_BY_SELECT } },
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.feedingRecord.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }
}
