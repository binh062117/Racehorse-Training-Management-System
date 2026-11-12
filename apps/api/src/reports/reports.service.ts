import { Injectable } from '@nestjs/common';
import { IncidentStatus, Role, SessionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../files/cloudinary.service';
import { FileStorageService } from '../files/file-storage.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateExpenseDto, FinanceReportQueryDto } from './dto/reports.dto';
import { planProgress } from '../training/plan-progress';
import { raceReadiness } from '../races/race-readiness';

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

export const TRAINING_MEDIA_KIND = 'training-media';
export const MEDIA_MIME: Record<
  string,
  { ext: string; kind: 'IMAGE' | 'VIDEO' }
> = {
  'image/jpeg': { ext: 'jpg', kind: 'IMAGE' },
  'image/png': { ext: 'png', kind: 'IMAGE' },
  'image/webp': { ext: 'webp', kind: 'IMAGE' },
  'video/mp4': { ext: 'mp4', kind: 'VIDEO' },
  'video/webm': { ext: 'webm', kind: 'VIDEO' },
  'video/quicktime': { ext: 'mov', kind: 'VIDEO' },
};
const API_PREFIX = '/api/v1';

function monthRange(month?: string) {
  const now = new Date();
  const [y, m] =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
  // Months in the club's timezone (UTC+7).
  const start = new Date(Date.UTC(y, m - 1, 1) - 7 * 3600_000);
  const end = new Date(Date.UTC(y, m, 1) - 7 * 3600_000);
  return { start, end, label: `${String(m).padStart(2, '0')}/${y}` };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly storage: FileStorageService,
  ) {}

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

  // ---------- training media ----------
  async addMedia(
    horseId: string,
    file: Express.Multer.File,
    body: { caption?: string; sessionId?: string },
    user: AuthUser,
  ) {
    const meta = MEDIA_MIME[file.mimetype];
    if (!meta)
      throw new AppException(
        'VALIDATION_ERROR',
        'Chỉ nhận ảnh JPEG/PNG/WebP hoặc video MP4/WebM/MOV.',
      );
    if (body.sessionId) {
      const s = await this.prisma.trainingSession.findUnique({
        where: { id: body.sessionId },
        select: { horseId: true },
      });
      if (!s || s.horseId !== horseId)
        throw new AppException(
          'VALIDATION_ERROR',
          'sessionId must reference a session of this horse',
        );
    }
    const publicId = `${horseId}-${randomBytes(4).toString('hex')}`;
    let url: string;
    if (this.cloudinary.enabled) {
      url = await this.cloudinary.uploadBuffer(
        file.buffer,
        TRAINING_MEDIA_KIND,
        publicId,
        meta.kind === 'VIDEO' ? 'video' : 'image',
      );
    } else {
      const filename = `${publicId}.${meta.ext}`;
      this.storage.saveBuffer(TRAINING_MEDIA_KIND, filename, file.buffer);
      url = `${API_PREFIX}/files/${TRAINING_MEDIA_KIND}/${filename}`;
    }
    return this.prisma.trainingMedia.create({
      data: {
        horseId,
        sessionId: body.sessionId ?? null,
        kind: meta.kind,
        url,
        caption: body.caption?.trim() || null,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: { id: true, name: true, role: true } } },
    });
  }

  listMedia(horseId: string, since?: Date, until?: Date) {
    return this.prisma.trainingMedia.findMany({
      where: {
        horseId,
        ...(since
          ? { createdAt: { gte: since, ...(until ? { lt: until } : {}) } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
        session: { select: { id: true, type: true, scheduledAt: true } },
      },
    });
  }

  async removeMedia(id: string, user: AuthUser) {
    const m = await this.prisma.trainingMedia.findUnique({ where: { id } });
    if (!m) throw new AppException('NOT_FOUND', 'Media not found');
    if (m.uploadedById !== user.id && user.role !== Role.MANAGER) {
      throw new AppException(
        'FORBIDDEN',
        'Only the uploader or a manager can remove this',
      );
    }
    await this.prisma.trainingMedia.delete({ where: { id } });
    if (m.url.startsWith('http')) void this.cloudinary.destroyByUrl(m.url);
    else this.storage.removeQuietly(m.url.replace(`${API_PREFIX}/files/`, ''));
    return { message: 'Media removed' };
  }

  /** For the local-disk fallback route: the media row owning a file, with ownership checked. */
  async findMediaFile(filename: string, user: AuthUser) {
    const m = await this.prisma.trainingMedia.findFirst({
      where: { url: `${API_PREFIX}/files/${TRAINING_MEDIA_KIND}/${filename}` },
      include: { horse: { select: { ownerId: true } } },
    });
    if (!m) throw new AppException('NOT_FOUND', 'File not found');
    if (user.role === Role.OWNER && m.horse.ownerId !== user.id)
      throw new AppException(
        'FORBIDDEN',
        'This horse belongs to another owner',
      );
    return m;
  }

  // ---------- owner report ----------
  /**
   * Everything an owner pays for, for one horse and one month: who examined it,
   * what it ate and what that cost, how training went, races, and pictures.
   */
  async horseReport(horseId: string, month?: string) {
    const { start, end, label } = monthRange(month);
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: {
        id: true,
        name: true,
        breed: true,
        status: true,
        healthStatus: true,
        locked: true,
        lockReason: true,
        fitnessScore: true,
        photoPath: true,
        owner: { select: { id: true, name: true } },
        trainer: { select: { id: true, name: true } },
        groom: { select: { id: true, name: true } },
      },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    const inMonth = { gte: start, lt: end };

    const [
      exams,
      feeding,
      sessions,
      plans,
      entries,
      assessments,
      incidents,
      media,
    ] = await Promise.all([
      this.prisma.healthRecord.findMany({
        where: { horseId, examDate: inMonth },
        orderBy: { examDate: 'desc' },
        select: {
          id: true,
          examDate: true,
          diagnosis: true,
          treatment: true,
          healthStatus: true,
          vet: { select: { id: true, name: true } },
        },
      }),
      this.prisma.feedingRecord.findMany({
        where: { horseId, date: inMonth },
        select: { feedType: true, quantityKg: true, costVnd: true },
      }),
      this.prisma.trainingSession.findMany({
        where: { horseId, scheduledAt: inMonth },
        select: {
          status: true,
          distanceM: true,
          finishTimeSec: true,
          recoveryHeartRate: true,
        },
      }),
      this.prisma.trainingPlan.findMany({
        where: {
          horseId,
          startDate: { lt: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        orderBy: { startDate: 'desc' },
        include: {
          trainer: { select: { name: true } },
          sessions: { select: { status: true, distanceM: true } },
        },
      }),
      this.prisma.raceEntry.findMany({
        where: { horseId },
        orderBy: { race: { date: 'desc' } },
        take: 10,
        select: {
          id: true,
          position: true,
          time: true,
          race: {
            select: {
              id: true,
              name: true,
              date: true,
              venue: true,
              distance: true,
            },
          },
        },
      }),
      this.prisma.fitnessAssessment.findMany({
        where: { horseId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          totalScore: true,
          createdAt: true,
          assessedBy: { select: { name: true } },
        },
      }),
      this.prisma.incidentReport.findMany({
        where: { horseId, createdAt: inMonth },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          description: true,
          severity: true,
          status: true,
          createdAt: true,
        },
      }),
      this.listMedia(horseId, start, end),
    ]);

    // Feeding: total cost, and per feed type.
    const byFeed = new Map<
      string,
      { feedType: string; kg: number; costVnd: number; meals: number }
    >();
    let feedCost = 0;
    let uncostedMeals = 0;
    for (const f of feeding) {
      const row = byFeed.get(f.feedType) ?? {
        feedType: f.feedType,
        kg: 0,
        costVnd: 0,
        meals: 0,
      };
      row.kg += f.quantityKg;
      row.meals += 1;
      if (f.costVnd != null) {
        row.costVnd += f.costVnd;
        feedCost += f.costVnd;
      } else uncostedMeals++;
      byFeed.set(f.feedType, row);
    }
    const finish = sessions.filter(
      (s) => s.status === SessionStatus.DONE && s.finishTimeSec != null,
    );
    const [readiness] = await raceReadiness(this.prisma, [horseId]);

    return {
      month: label,
      horse,
      health: {
        exams,
        vets: [...new Set(exams.map((e) => e.vet.name))],
        incidents,
        openIncidents: incidents.filter(
          (i) => i.status !== IncidentStatus.RESOLVED,
        ).length,
      },
      feeding: {
        totalCostVnd: feedCost,
        totalKg:
          Math.round(feeding.reduce((s, f) => s + f.quantityKg, 0) * 10) / 10,
        meals: feeding.length,
        uncostedMeals,
        byFeed: [...byFeed.values()].sort((a, b) => b.costVnd - a.costVnd),
      },
      training: {
        sessions: sessions.length,
        done: sessions.filter((s) => s.status === SessionStatus.DONE).length,
        missed: sessions.filter((s) => s.status === SessionStatus.MISSED)
          .length,
        avgFinishTimeSec: finish.length
          ? Math.round(
              (finish.reduce((s, x) => s + (x.finishTimeSec ?? 0), 0) /
                finish.length) *
                10,
            ) / 10
          : null,
        plans: plans.map((p) => ({
          id: p.id,
          goal: p.goal,
          trainer: p.trainer.name,
          endDate: p.endDate,
          targetDistanceM: p.targetDistanceM,
          progress: planProgress(p, p.sessions),
        })),
        assessments,
      },
      races: entries,
      readiness,
      media,
    };
  }

  // ---------- to-do list per role ----------
  /** The concrete things waiting for this person today, with counts and links. */
  async tasks(user: AuthUser) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
    const soon = new Date(now.getTime() + 14 * 24 * 3600_000);
    const t: {
      key: string;
      count: number;
      to: string;
      tone: 'bad' | 'warn' | 'info' | 'ok';
    }[] = [];
    const add = (
      key: string,
      count: number,
      to: string,
      tone: 'bad' | 'warn' | 'info' | 'ok' = 'info',
    ) => {
      if (count > 0) t.push({ key, count, to, tone });
    };
    const live = { deletedAt: null };

    switch (user.role) {
      case Role.VET: {
        add(
          'openIncidents',
          await this.prisma.incidentReport.count({
            where: { status: { not: IncidentStatus.RESOLVED }, horse: live },
          }),
          '/incidents',
          'bad',
        );
        add(
          'lockedHorses',
          await this.prisma.horse.count({ where: { ...live, locked: true } }),
          '/horses?filter=locked',
          'warn',
        );
        add(
          'vaccinesDue',
          await this.prisma.vaccination.count({
            where: { nextDueDate: { lte: soon }, horse: live },
          }),
          '/vaccinations',
          'warn',
        );
        break;
      }
      case Role.TRAINER: {
        add(
          'sessionsToday',
          await this.prisma.trainingSession.count({
            where: {
              trainerId: user.id,
              status: SessionStatus.PLANNED,
              scheduledAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          '/plans',
          'info',
        );
        add(
          'resultsToRecord',
          await this.prisma.trainingSession.count({
            where: {
              trainerId: user.id,
              status: SessionStatus.PLANNED,
              scheduledAt: {
                lt: now,
                gte: new Date(now.getTime() - 24 * 3600_000),
              },
            },
          }),
          '/plans',
          'warn',
        );
        const myPlans = await this.prisma.trainingPlan.findMany({
          where: { trainerId: user.id, horse: live },
          include: { sessions: { select: { status: true, distanceM: true } } },
        });
        add(
          'overduePlans',
          myPlans.filter((p) => planProgress(p, p.sessions, now).overdue)
            .length,
          '/plans?status=OVERDUE',
          'bad',
        );
        add(
          'lockedHorses',
          await this.prisma.horse.count({
            where: { ...live, locked: true, trainerId: user.id },
          }),
          '/horses?filter=locked',
          'warn',
        );
        break;
      }
      case Role.GROOM: {
        add(
          'careToday',
          await this.prisma.dailyCareLog.count({
            where: { date: { gte: dayStart, lt: dayEnd }, completed: false },
          }),
          '/daily-care',
          'info',
        );
        add(
          'myRequestsWaiting',
          await this.prisma.supplyRequest.count({
            where: { requestedById: user.id, status: 'PENDING' },
          }),
          '/supplies',
          'info',
        );
        const items = await this.prisma.supplyItem.findMany({
          where: { deletedAt: null },
          select: { quantity: true, minQuantity: true },
        });
        add(
          'lowSupplies',
          items.filter((i) => i.quantity <= i.minQuantity).length,
          '/supplies',
          'warn',
        );
        break;
      }
      case Role.MANAGER: {
        add(
          'pendingAccounts',
          await this.prisma.user.count({
            where: { status: 'PENDING', deletedAt: null },
          }),
          '/admin/users',
          'warn',
        );
        add(
          'supplyRequests',
          await this.prisma.supplyRequest.count({
            where: { status: 'PENDING' },
          }),
          '/supplies',
          'warn',
        );
        const plans = await this.prisma.trainingPlan.findMany({
          where: { horse: live, endDate: { lt: now } },
          include: { sessions: { select: { status: true, distanceM: true } } },
        });
        add(
          'overduePlans',
          plans.filter((p) => planProgress(p, p.sessions, now).overdue).length,
          '/plans?status=OVERDUE',
          'bad',
        );
        add(
          'openIncidents',
          await this.prisma.incidentReport.count({
            where: {
              status: { not: IncidentStatus.RESOLVED },
              severity: 'HIGH',
              horse: live,
            },
          }),
          '/incidents',
          'bad',
        );
        break;
      }
      case Role.OWNER: {
        const mine = { ...live, ownerId: user.id };
        add(
          'myLockedHorses',
          await this.prisma.horse.count({ where: { ...mine, locked: true } }),
          '/my-horses',
          'bad',
        );
        add(
          'myOpenIncidents',
          await this.prisma.incidentReport.count({
            where: { status: { not: IncidentStatus.RESOLVED }, horse: mine },
          }),
          '/my-horses',
          'warn',
        );
        add(
          'myReports',
          await this.prisma.horse.count({ where: mine }),
          '/reports',
          'info',
        );
        break;
      }
    }
    return t;
  }
}
