import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { Paginated } from '../horses/horses.service';
import {
  CreateRaceDto,
  CreateRaceEntryDto,
  ListRaceEntriesQueryDto,
  ListRacesQueryDto,
  UpdateRaceDto,
  UpdateRaceEntryDto,
} from './dto/races.dto';

const ENTRY_HORSE_SELECT = { id: true, name: true, ownerId: true } as const;
const ENTRY_RACE_SELECT = {
  id: true,
  name: true,
  date: true,
  venue: true,
} as const;

@Injectable()
export class RacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRaceDto) {
    return this.prisma.race.create({
      data: {
        name: dto.name.trim(),
        date: new Date(dto.date),
        venue: dto.venue?.trim() ?? null,
        distance: dto.distance ?? null,
        surface: dto.surface?.trim() ?? null,
        prizePool: dto.prizePool ?? null,
      },
    });
  }

  async list(
    q: ListRacesQueryDto,
  ): Promise<Paginated<Prisma.RaceGetPayload<object>>> {
    const where: Prisma.RaceWhereInput = {
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.race.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.race.count({ where }),
    ]);
    return { data: rows, meta: { page: q.page, limit: q.limit, total } };
  }

  async get(id: string) {
    const race = await this.prisma.race.findUnique({
      where: { id },
      include: {
        entries: {
          include: { horse: { select: ENTRY_HORSE_SELECT } },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!race) throw new AppException('NOT_FOUND', 'Race not found');
    return race;
  }

  async update(id: string, dto: UpdateRaceDto) {
    const existing = await this.prisma.race.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Race not found');

    const data: Prisma.RaceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.venue !== undefined) data.venue = dto.venue?.trim() ?? null;
    if (dto.distance !== undefined) data.distance = dto.distance;
    if (dto.surface !== undefined) data.surface = dto.surface?.trim() ?? null;
    if (dto.prizePool !== undefined) data.prizePool = dto.prizePool;

    return this.prisma.race.update({ where: { id }, data });
  }

  async addEntry(raceId: string, dto: CreateRaceEntryDto) {
    const race = await this.prisma.race.findUnique({
      where: { id: raceId },
      select: { id: true },
    });
    if (!race) throw new AppException('NOT_FOUND', 'Race not found');

    const horse = await this.prisma.horse.findFirst({
      where: { id: dto.horseId, deletedAt: null },
      select: {
        id: true,
        name: true,
        locked: true,
        lockReason: true,
        status: true,
        healthStatus: true,
      },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    if (horse.locked) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Chiến mã ${horse.name} đang bị khóa huấn luyện/thi đấu (${horse.lockReason ?? 'theo chỉ định y tế'}), không thể đăng ký giải đua.`,
      );
    }

    if (horse.status === 'RETIRED') {
      throw new AppException(
        'VALIDATION_ERROR',
        `Chiến mã ${horse.name} đã giải nghệ (RETIRED), không thể đăng ký giải đua.`,
      );
    }

    if (horse.healthStatus === 'QUARANTINED') {
      throw new AppException(
        'VALIDATION_ERROR',
        `Chiến mã ${horse.name} đang cách ly y tế (QUARANTINED), không thể đăng ký giải đua.`,
      );
    }

    const dupe = await this.prisma.raceEntry.findUnique({
      where: { raceId_horseId: { raceId, horseId: dto.horseId } },
      select: { id: true },
    });
    if (dupe) {
      throw new AppException(
        'CONFLICT',
        'This horse is already entered in this race',
      );
    }

    try {
      return await this.prisma.raceEntry.create({
        data: {
          raceId,
          horseId: dto.horseId,
          position: dto.position ?? null,
          time: dto.time ?? null,
        },
        include: { horse: { select: ENTRY_HORSE_SELECT } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'CONFLICT',
          'This horse is already entered in this race',
        );
      }
      throw error;
    }
  }

  async listByHorse(
    horseId: string,
    q: ListRaceEntriesQueryDto,
  ): Promise<
    Paginated<
      Prisma.RaceEntryGetPayload<{
        include: { race: { select: typeof ENTRY_RACE_SELECT } };
      }>
    >
  > {
    const where: Prisma.RaceEntryWhereInput = { horseId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.raceEntry.findMany({
        where,
        include: { race: { select: ENTRY_RACE_SELECT } },
        orderBy: { race: { date: 'desc' } },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.raceEntry.count({ where }),
    ]);
    return { data: rows, meta: { page: q.page, limit: q.limit, total } };
  }

  /** MANAGER-only route (RolesGuard) — no ownership check needed here. */
  async updateEntry(id: string, dto: UpdateRaceEntryDto) {
    const existing = await this.prisma.raceEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', 'Race entry not found');

    const data: Prisma.RaceEntryUpdateInput = {};
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.time !== undefined) data.time = dto.time;

    return this.prisma.raceEntry.update({
      where: { id },
      data,
      include: { horse: { select: ENTRY_HORSE_SELECT } },
    });
  }
}
