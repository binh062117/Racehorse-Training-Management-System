import type { TrainingPlan } from './types';

export function clubDay(value: string): string {
  return new Date(new Date(value).getTime() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}

/** Same calendar-day boundaries as the API, independent of browser timezone. */
export function scheduleError(value: string, plan?: TrainingPlan, now = Date.now()): string | null {
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return 'session.invalidDate';
  if (at < now) return 'hai.pastTime';
  if (plan && (clubDay(value) < clubDay(plan.startDate) || (plan.endDate && clubDay(value) > clubDay(plan.endDate)))) return 'hai.planDates';
  return null;
}
