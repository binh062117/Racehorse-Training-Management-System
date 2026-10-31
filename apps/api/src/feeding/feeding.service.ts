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

    const data = {
      horseId,
      recordedById: recordedBy.id,
      feedType: dto.feedType.trim(),
      quantityKg: dto.quantityKg,
      date: new Date(dto.date),
      notes: dto.notes?.trim() || null,
    };
    const include = {
      recordedBy: { select: RECORDED_BY_SELECT },
      supplyItem: {
        select: { id: true, name: true, unit: true, quantity: true },
      },
    };
    if (!dto.supplyItemId) {
      return this.prisma.feedingRecord.create({ data, include });
    }

    // Feed from the store: check it is feed and there is enough, then record
    // the meal and take it out of stock together.
    const item = await this.prisma.supplyItem.findFirst({
      where: { id: dto.supplyItemId, deletedAt: null },
      select: {
        id: true,
        name: true,
        unit: true,
        category: true,
        quantity: true,
      },
    });
    if (!item || item.category !== 'FEED') {
      throw new AppException(
        'VALIDATION_ERROR',
        'supplyItemId must reference a feed item in the store',
      );
    }
    if (item.quantity < dto.quantityKg) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Kho chỉ còn ${item.quantity} ${item.unit} ${item.name} — không đủ ${dto.quantityKg} ${item.unit}. Hãy gửi yêu cầu mua thêm.`,
      );
    }
    const [record] = await this.prisma.$transaction([
      this.prisma.feedingRecord.create({
        data: { ...data, supplyItemId: item.id },
        include,
      }),
      this.prisma.supplyItem.update({
        where: { id: item.id },
        data: { quantity: { decrement: dto.quantityKg } },
      }),
    ]);
    return record;
  }

  async listByHorse(horseId: string, q: ListFeedingRecordsQueryDto) {
    const where: Prisma.FeedingRecordWhereInput = { horseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.feedingRecord.findMany({
        where,
        include: {
          recordedBy: { select: RECORDED_BY_SELECT },
          supplyItem: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.feedingRecord.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }
}
