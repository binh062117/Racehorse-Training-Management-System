import { SessionStatus } from '@prisma/client';

/**
 * A training plan's progress, measured by its sessions — not by the calendar.
 *
 * - Complete = every session of the plan is DONE (cancelled ones don't count,
 *   and a plan with no sessions is never complete).
 * - Overdue  = the end date has passed, the plan has sessions and is not
 *   complete (an empty plan was never started, so nobody is late on it). That does
 *   not block anything; it is reported to the manager (the coach is late).
 * - Distance short = the plan has a target distance and no DONE session has
 *   reached it yet.
 */
export interface PlanProgress {
  total: number;
  done: number;
  planned: number;
  missed: number;
  cancelled: number;
  pct: number;
  complete: boolean;
  overdue: boolean;
  maxDoneDistanceM: number | null;
  distanceShort: boolean;
}

export function planProgress(
  plan: { endDate: Date | null; targetDistanceM: number | null },
  sessions: { status: SessionStatus; distanceM: number | null }[],
  now = new Date(),
): PlanProgress {
  const count = (s: SessionStatus) =>
    sessions.filter((x) => x.status === s).length;
  const done = count(SessionStatus.DONE);
  const cancelled = count(SessionStatus.CANCELLED);
  const counted = sessions.length - cancelled;
  const complete = counted > 0 && done === counted;
  const doneDistances = sessions
    .filter((x) => x.status === SessionStatus.DONE && x.distanceM != null)
    .map((x) => x.distanceM as number);
  const maxDoneDistanceM = doneDistances.length
    ? Math.max(...doneDistances)
    : null;
  return {
    total: sessions.length,
    done,
    planned: count(SessionStatus.PLANNED),
    missed: count(SessionStatus.MISSED),
    cancelled,
    pct: counted > 0 ? Math.round((done / counted) * 100) : 0,
    complete,
    overdue:
      counted > 0 &&
      !complete &&
      plan.endDate != null &&
      plan.endDate.getTime() < now.getTime(),
    maxDoneDistanceM,
    distanceShort:
      plan.targetDistanceM != null &&
      (maxDoneDistanceM == null || maxDoneDistanceM < plan.targetDistanceM),
  };
}
