import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useCachedResource } from '../../lib/useCachedResource';
import type { Paginated, TaskItem, TrainingPlan } from '../../lib/types';
import { planState } from '../training/PlanProgress';
import { Card, CardHeader, Icon } from '../../ds/ui';

const TONE = {
  bad: 'bg-bad-bg text-bad-ink',
  warn: 'bg-warn-bg text-warn-ink',
  info: 'bg-info-bg text-info-ink',
  ok: 'bg-ok-bg text-ok-ink',
} as const;

/** "What needs me today" — counted from real data by GET /me/tasks. */
export function useMyTasks(userId: string | undefined) {
  return useCachedResource(`dashboard:tasks:${userId ?? 'anon'}`, () =>
    api.get<TaskItem[]>('/me/tasks').then((r) => r.data).catch(() => [] as TaskItem[]),
  );
}

export function TaskRows({ tasks }: { tasks: TaskItem[] }) {
  const { t } = useTranslation();
  const open = tasks.filter((x) => x.count > 0);
  if (open.length === 0) return null;
  return (
    <ul className="list-none p-0 m-0">
      {open.map((task) => (
        <li key={task.key}>
          <Link to={task.to} className="flex items-center gap-3 px-5 py-3 border-b border-line-soft no-underline text-ink hover:bg-subtle">
            <span className={`num min-w-8 h-7 px-2 rounded-badge inline-flex items-center justify-center text-[13px] font-semibold ${TONE[task.tone]}`}>{task.count}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium">{t(`myTasks.${task.key}.title`, { count: task.count })}</span>
              <span className="block text-[12.5px] text-muted">{t(`myTasks.${task.key}.desc`)}</span>
            </span>
            <Icon name="chevRight" className="w-4 h-4 text-muted nudge" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Manager: which trainers have plans past their end date and not complete. */
export function OverdueCoaches() {
  const { t } = useTranslation();
  const { data } = useCachedResource('dashboard:overdue-coaches', () =>
    api.get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => [] as TrainingPlan[]),
  );
  const overdue = (data ?? []).filter((p) => planState(p) === 'OVERDUE');
  if (overdue.length === 0) return null;
  const byTrainer = new Map<string, { name: string; plans: TrainingPlan[] }>();
  for (const p of overdue) {
    const id = p.trainerId ?? 'none';
    const row = byTrainer.get(id) ?? { name: p.trainer?.name ?? '—', plans: [] };
    row.plans.push(p);
    byTrainer.set(id, row);
  }
  return (
    <Card>
      <CardHeader title={t('myTasks.overdueCoaches')}>
        <Link to="/plans?status=OVERDUE" className="text-[13px] font-medium text-info no-underline">{t('dashboard.viewAll', 'Xem tất cả')}</Link>
      </CardHeader>
      <ul className="list-none p-0 m-0">
        {[...byTrainer.entries()].sort((a, b) => b[1].plans.length - a[1].plans.length).map(([id, row]) => (
          <li key={id} className="px-5 py-3 border-b border-line-soft last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.name}</span>
              <span className="text-[12.5px] font-semibold text-bad">{t('myTasks.latePlans', { count: row.plans.length })}</span>
            </div>
            <div className="text-[12.5px] text-muted mt-0.5 truncate">
              {row.plans.map((p) => `${p.horse?.name ?? ''} (${p.progress?.done ?? 0}/${(p.progress?.total ?? 0) - (p.progress?.cancelled ?? 0)})`).join(' · ')}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
