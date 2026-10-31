import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateExpenseDto, FinanceReportQueryDto } from './dto/reports.dto';

export interface FinanceTransaction {
  id: string;
  date: string;
  horseId: string;
  horseName: string;
  category:
    | 'PRIZE'
    | 'FEEDING'
    | 'FARRIER'
    | 'VACCINATION'
    | 'DEWORMING'
    | 'MEDICAL'
    | 'BOARDING';
  type: 'INCOME' | 'EXPENSE';
  description: string;
  amount: number;
}

export interface HorseFinanceSummary {
  horseId: string;
  horseName: string;
  ownerId: string;
  ownerName: string;
  prizeMoney: number;
  totalCost: number;
  netBalance: number;
  entryCount: number;
  costs: {
    feeding: number;
    farrier: number;
    preventive: number;
    medical: number;
    boarding: number;
  };
}

export interface FinanceReportResult {
  summary: {
    totalPrizeMoney: number;
    totalCost: number;
    netBalance: number;
    feedingCost: number;
    farrierCost: number;
    preventiveCost: number;
    medicalCost: number;
    boardingCost: number;
  };
  horses: HorseFinanceSummary[];
  transactions: FinanceTransaction[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceReport(
    q: FinanceReportQueryDto,
    user: AuthUser,
  ): Promise<FinanceReportResult> {
    if (user.role !== Role.MANAGER && user.role !== Role.OWNER) {
      throw new AppException(
        'FORBIDDEN',
        'Chỉ Quản lý (MANAGER) và Chủ ngựa (OWNER) mới có quyền xem báo cáo tài chính',
      );
    }

    if (q.from && q.to && new Date(q.from) > new Date(q.to)) {
      throw new AppException(
        'VALIDATION_ERROR',
        'From date must be before to date',
      );
    }
    const horseWhere: { id?: string; ownerId?: string; deletedAt: null } = {
      deletedAt: null,
    };
    if (user.role === Role.OWNER) {
      horseWhere.ownerId = user.id;
    }
    if (q.horseId) {
      if (user.role === Role.OWNER) {
        const checkOwner = await this.prisma.horse.findFirst({
          where: { id: q.horseId, ownerId: user.id, deletedAt: null },
          select: { id: true },
        });
        if (!checkOwner) {
          throw new AppException('FORBIDDEN', 'Bạn không sở hữu chiến mã này');
        }
      }
      horseWhere.id = q.horseId;
    }

    const horses = await this.prisma.horse.findMany({
      where: horseWhere,
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { name: true } },
        createdAt: true,
      },
    });

    const horseIds = horses.map((h) => h.id);
    if (horseIds.length === 0) {
      return {
        summary: {
          totalPrizeMoney: 0,
          totalCost: 0,
          netBalance: 0,
          feedingCost: 0,
          farrierCost: 0,
          preventiveCost: 0,
          medicalCost: 0,
          boardingCost: 0,
        },
        horses: [],
        transactions: [],
      };
    }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (q.from) dateFilter.gte = new Date(q.from);
    if (q.to) dateFilter.lte = new Date(q.to);
    const hasDateFilter = q.from || q.to;

    // 1. Fetch race entries (Prize money)
    const raceEntries = await this.prisma.raceEntry.findMany({
      where: {
        horseId: { in: horseIds },
        ...(hasDateFilter ? { race: { date: dateFilter } } : {}),
      },
      include: {
        race: { select: { id: true, name: true, date: true, prizePool: true } },
        horse: { select: { id: true, name: true } },
      },
    });

    const expenses = await this.prisma.horseExpense.findMany({
      where: {
        horseId: { in: horseIds },
        ...(hasDateFilter ? { date: dateFilter } : {}),
      },
      include: { horse: { select: { name: true } } },
    });

    const transactions: FinanceTransaction[] = [];
    const horseSummaryMap = new Map<string, HorseFinanceSummary>();

    for (const h of horses) {
      horseSummaryMap.set(h.id, {
        horseId: h.id,
        horseName: h.name,
        ownerId: h.ownerId,
        ownerName: h.owner.name,
        prizeMoney: 0,
        totalCost: 0,
        netBalance: 0,
        entryCount: 0,
        costs: {
          feeding: 0,
          farrier: 0,
          preventive: 0,
          medical: 0,
          boarding: 0,
        },
      });
    }

    // Process race prizes
    for (const entry of raceEntries) {
      const summary = horseSummaryMap.get(entry.horseId);
      if (summary) summary.entryCount += 1;

      const prize = entry.status === 'COMPLETED' ? (entry.prizeWon ?? 0) : 0;

      if (prize > 0) {
        if (summary) summary.prizeMoney += prize;
        transactions.push({
          id: `prize-${entry.id}`,
          date: entry.race.date.toISOString(),
          horseId: entry.horseId,
          horseName: entry.horse.name,
          category: 'PRIZE',
          type: 'INCOME',
          description: `Tiền thưởng giải ${entry.race.name}${entry.position ? ` (Hạng #${entry.position})` : ''}`,
          amount: prize,
        });
      }
    }

    for (const expense of expenses) {
      const summary = horseSummaryMap.get(expense.horseId)!;
      const key = {
        FEEDING: 'feeding',
        FARRIER: 'farrier',
        VACCINATION: 'preventive',
        DEWORMING: 'preventive',
        MEDICAL: 'medical',
        BOARDING: 'boarding',
      }[expense.category] as keyof HorseFinanceSummary['costs'];
      summary.costs[key] += expense.amount;
      transactions.push({
        id: expense.id,
        date: expense.date.toISOString(),
        horseId: expense.horseId,
        horseName: expense.horse.name,
        category: expense.category as FinanceTransaction['category'],
        type: 'EXPENSE',
        description: expense.description,
        amount: expense.amount,
      });
    }

    // Calculate totals
    let totalPrizeMoney = 0;
    let feedingCost = 0;
    let farrierCost = 0;
    let preventiveCost = 0;
    let medicalCost = 0;
    let boardingCost = 0;

    for (const summary of horseSummaryMap.values()) {
      summary.totalCost =
        summary.costs.feeding +
        summary.costs.farrier +
        summary.costs.preventive +
        summary.costs.medical +
        summary.costs.boarding;
      summary.netBalance = summary.prizeMoney - summary.totalCost;

      totalPrizeMoney += summary.prizeMoney;
      feedingCost += summary.costs.feeding;
      farrierCost += summary.costs.farrier;
      preventiveCost += summary.costs.preventive;
      medicalCost += summary.costs.medical;
      boardingCost += summary.costs.boarding;
    }

    const totalCost =
      feedingCost + farrierCost + preventiveCost + medicalCost + boardingCost;
    const netBalance = totalPrizeMoney - totalCost;

    // Sort transactions by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      summary: {
        totalPrizeMoney,
        totalCost,
        netBalance,
        feedingCost,
        farrierCost,
        preventiveCost,
        medicalCost,
        boardingCost,
      },
      horses: Array.from(horseSummaryMap.values()),
      transactions,
    };
  }
  async createExpense(dto: CreateExpenseDto) {
    const horse = await this.prisma.horse.findFirst({
      where: { id: dto.horseId, deletedAt: null },
      select: { id: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    return this.prisma.horseExpense.create({
      data: {
        horseId: dto.horseId,
        date: new Date(dto.date),
        category: dto.category,
        description: dto.description.trim(),
        amount: dto.amount,
      },
    });
  }
}
