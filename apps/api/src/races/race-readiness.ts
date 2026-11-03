import type { PrismaService } from '../prisma/prisma.service';
import { planProgress } from '../training/plan-progress';
import { FITNESS_PASS } from '../horses/horses.service';

export interface RaceReadiness {
  horseId: string;
  horseName: string;
  ready: boolean;
  /** Plain-language reasons the horse can't be entered yet (empty when ready). */
  reasons: string[];
  fitnessScore: number | null;
  latestPlan: {
    id: string;
    goal: string;
    done: number;
    total: number;
    complete: boolean;
  } | null;
}

/**
 * Flow 1, last step — a horse may be entered in a race only when:
 * not locked / retired / quarantined, its latest training plan is complete
 * (every session DONE), and its fitness score (from the vet's 5-criteria
 * assessment) is FITNESS_PASS or more.
 */
export async function raceReadiness(
  prisma: PrismaService,
  horseIds: string[],
): Promise<RaceReadiness[]> {
  const horses = await prisma.horse.findMany({
    where: { id: { in: horseIds }, deletedAt: null },
    select: {
      id: true,
      name: true,
      locked: true,
      lockReason: true,
      status: true,
      healthStatus: true,
      fitnessScore: true,
      trainingPlans: {
        orderBy: { startDate: 'desc' },
        take: 1,
        select: {
          id: true,
          goal: true,
          endDate: true,
          targetDistanceM: true,
          sessions: { select: { status: true, distanceM: true } },
        },
      },
    },
  });
  return horses.map((h) => {
    const reasons: string[] = [];
    if (h.locked)
      reasons.push(
        `đang bị khóa tập (${h.lockReason ?? 'theo chỉ định y tế'})`,
      );
    if (h.status === 'RETIRED') reasons.push('đã giải nghệ');
    if (h.healthStatus === 'QUARANTINED') reasons.push('đang cách ly y tế');
    const plan = h.trainingPlans[0];
    const progress = plan ? planProgress(plan, plan.sessions) : null;
    if (!plan) reasons.push('chưa có giáo án huấn luyện');
    else if (!progress!.complete)
      reasons.push(
        `giáo án "${plan.goal}" chưa hoàn thành (${progress!.done}/${progress!.total - progress!.cancelled} buổi)`,
      );
    if (h.fitnessScore == null)
      reasons.push('chưa được bác sĩ đánh giá thể lực');
    else if (h.fitnessScore < FITNESS_PASS)
      reasons.push(
        `điểm thể lực ${h.fitnessScore}/100, cần từ ${FITNESS_PASS}`,
      );
    return {
      horseId: h.id,
      horseName: h.name,
      ready: reasons.length === 0,
      reasons,
      fitnessScore: h.fitnessScore,
      latestPlan: plan
        ? {
            id: plan.id,
            goal: plan.goal,
            done: progress!.done,
            total: progress!.total - progress!.cancelled,
            complete: progress!.complete,
          }
        : null,
    };
  });
}
