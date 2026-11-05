import { useTranslation } from 'react-i18next';
import type { TrainingPlan } from '../../lib/types';
import { Badge, Bar } from '../../ds/ui';

export type PlanState = 'COMPLETE' | 'OVERDUE' | 'ACTIVE';

/** Complete = every session DONE; overdue = past the end date and not complete. */
export function planState(plan: Pick<TrainingPlan, 'progress'>): PlanState {
  if (plan.progress?.complete) return 'COMPLETE';
  if (plan.progress?.overdue) return 'OVERDUE';
  return 'ACTIVE';
}

export function PlanStateBadge({ plan }: { plan: TrainingPlan }) {
  const { t } = useTranslation();
  const s = planState(plan);
  return s === 'COMPLETE'
    ? <Badge tone="ok">{t('planProgress.complete')}</Badge>
    : s === 'OVERDUE'
      ? <Badge tone="bad">{t('planProgress.overdue')}</Badge>
      : <Badge tone="info">{t('planProgress.active')}</Badge>;
}

/** Sessions done out of the plan's sessions, plus the distance warning. */
export function PlanProgressCell({ plan, compact = false }: { plan: Pick<TrainingPlan, 'progress' | 'targetDistanceM'>; compact?: boolean }) {
  const { t } = useTranslation();
  const p = plan.progress;
  if (!p) return null;
  const counted = p.total - p.cancelled;
  const s = planState(plan);
  return (
    <div className="min-w-0">
      {counted === 0 ? (
        <span className="text-[13px] text-muted">{t('planProgress.noSessions')}</span>
      ) : (
        <div className="flex items-center gap-2.5">
          <Bar pct={p.pct} color={s === 'COMPLETE' ? '#247b50' : s === 'OVERDUE' ? '#c4242a' : '#1a4b8a'} className="flex-1" />
          <span className="num text-[12.5px] text-muted whitespace-nowrap">{t('planProgress.sessions', { done: p.done, total: counted })}</span>
        </div>
      )}
      {!compact && p.missed > 0 && <div className="text-[12px] text-warn mt-1">{t('planProgress.missed', { n: p.missed })}</div>}
      {plan.targetDistanceM != null && (
        <div className={`text-[12px] mt-1 ${p.distanceShort ? 'text-warn' : 'text-ok'}`}>
          {p.distanceShort
            ? t('planProgress.distanceShort', { target: plan.targetDistanceM, best: p.maxDoneDistanceM ?? 0 })
            : t('planProgress.distanceReached', { target: plan.targetDistanceM })}
        </div>
      )}
    </div>
  );
}
