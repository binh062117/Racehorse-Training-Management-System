import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { TrainingProgress, TrainingProgressRow } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate, formatDateTime } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Bar, Btn, Card, Chip, HeroStats, Icon, Seg, fitColor, healthTone } from '../ds/ui';

/**
 * UC-13 — View overall training progress. One row per horse, aggregated by
 * GET /training-progress (a single request, not one per horse).
 */

type Range = '30' | '90' | 'all';
type Filter = 'ALL' | 'OVERDUE' | 'NO_PLAN' | 'LOCKED';

const FILTERS: Filter[] = ['ALL', 'OVERDUE', 'NO_PLAN', 'LOCKED'];
const DAY_MS = 86_400_000;

const matches: Record<Filter, (r: TrainingProgressRow) => boolean> = {
  ALL: () => true,
  OVERDUE: (r) => r.sessions.overdue > 0,
  NO_PLAN: (r) => r.plans.active === 0,
  LOCKED: (r) => r.horse.locked,
};

/** Start of the window, fixed to the day so the cache key stays stable. */
function rangeStart(range: Range): string | null {
  if (range === 'all') return null;
  const d = new Date(Date.now() - Number(range) * DAY_MS);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function TrainingProgressPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('30');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  usePageChrome({ crumbs: [t('progress.crumbTraining'), t('progress.crumb')], search: t('progress.search'), onSearch: setSearch });

  const from = rangeStart(range);
  const { data, loading, error } = useCachedResource(`training-progress:${user?.id ?? ''}:${from ?? 'all'}`, () =>
    api.get<TrainingProgress>('/training-progress', { params: from ? { from } : {} }).then((r) => r.data),
  );
  const rows = useMemo(() => data?.horses ?? [], [data]);
  const summary = data?.summary;

  const counts = useMemo(() => {
    const c = { ALL: 0, OVERDUE: 0, NO_PLAN: 0, LOCKED: 0 } satisfies Record<Filter, number>;
    for (const r of rows) for (const f of FILTERS) if (matches[f](r)) c[f] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return rows.filter((r) => matches[filter](r) &&
      (!q || `${r.horse.name} ${r.horse.breed ?? ''} ${r.horse.owner.name}`.toLocaleLowerCase().includes(q)));
  }, [rows, filter, search]);

  const dash = loading && !data ? '…' : undefined;
  const s = summary?.sessions;

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">{t('progress.kicker')}</div>
            <h1 className="disp text-[56px] mt-2">{t('progress.title')}</h1>
            <p className="text-hero-muted mt-2.5 max-w-[560px]">
              {user?.role === 'OWNER' ? t('progress.descOwner') : t('progress.descStaff')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Seg dark value={range} onChange={(k) => setRange(k as Range)}
              options={[['30', t('progress.range30')], ['90', t('progress.range90')], ['all', t('progress.rangeAll')]]} />
            <span className="text-[12px] text-hero-muted">
              {from ? t('progress.rangeFrom', { date: formatDate(from) }) : t('progress.rangeAllLabel')}
            </span>
          </div>
        </div>
        <HeroStats items={[
          { label: t('progress.statHorses'), value: dash ?? summary?.horses ?? 0 },
          { label: t('progress.statWithPlan'), value: dash ?? summary?.horsesWithActivePlan ?? 0, color: '#9fd9b1' },
          { label: t('progress.statDone'), value: dash ?? s?.done ?? 0, small: s ? `/ ${s.total - s.cancelled}` : undefined },
          { label: t('progress.statRate'), value: dash ?? (summary?.completionRate ?? '—'), small: summary?.completionRate != null ? '%' : undefined },
          { label: t('progress.statOverdue'), value: dash ?? s?.overdue ?? 0, color: s?.overdue ? '#f3d29a' : undefined },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center" role="group" aria-label={t('progress.filterAria')}>
        {FILTERS.map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
            {t(`progress.filters.${f}`)} <span className="opacity-70">{counts[f]}</span>
          </Chip>
        ))}
        <span className="cap ml-auto">{t('progress.rateHint')}</span>
      </div>

      {loading && !data ? (
        <p className="cap">{t('progress.loading')}</p>
      ) : error ? (
        <ErrorText err={error} />
      ) : visible.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="reports" className="w-7 h-7 text-muted" />
          <p className="cap">{rows.length === 0 ? t('progress.empty') : t('progress.noMatch')}</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="text-left">
                  {(['horse', 'health', 'plans', 'progress', 'overdue', 'last', 'next'] as const).map((k) => (
                    <th key={k} className="h-[42px] px-4 bg-cream lbl border-b border-line">{t(`progress.cols.${k}`)}</th>
                  ))}
                  <th className="h-[42px] px-4 bg-cream border-b border-line" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => <ProgressRow key={r.horse.id} row={r} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function ProgressRow({ row }: { row: TrainingProgressRow }) {
  const { t } = useTranslation();
  const { horse, plans, sessions, completionRate, lastSession, nextSession } = row;
  const base = sessions.total - sessions.cancelled;
  return (
    <tr className="border-b border-line-soft hover:bg-subtle align-top">
      <td className="px-4 py-3">
        <Link to={`/horses/${horse.id}`} className="font-semibold text-navy no-underline">
          {horse.saddleNumber != null && <span className="text-muted mr-1">#{horse.saddleNumber}</span>}{horse.name}
        </Link>
        <div className="cap">{[horse.breed, horse.owner.name].filter(Boolean).join(' · ')}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge tone={healthTone[horse.healthStatus]}>{t(`horseStatusBadge.${horse.healthStatus}`)}</Badge>
          {horse.locked && <Badge tone="lock"><Icon name="lock" className="w-3 h-3" />{t('progress.locked')}</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        {plans.active > 0
          ? <Badge tone="ok">{t('progress.activePlans', { count: plans.active })}</Badge>
          : <Badge tone="neu">{t('progress.noPlan')}</Badge>}
        <div className="cap mt-1">{t('progress.totalPlans', { count: plans.total })}</div>
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Bar pct={completionRate ?? 0} color={fitColor(completionRate)} className="w-28" />
          <b className="num text-[13px]" style={{ color: fitColor(completionRate) }}>{completionRate != null ? `${completionRate}%` : '—'}</b>
        </div>
        <div className="cap mt-1">
          {t('progress.doneOf', { done: sessions.done, base, planned: sessions.planned })}
          {sessions.cancelled > 0 && t('progress.cancelled', { count: sessions.cancelled })}
        </div>
      </td>
      <td className="px-4 py-3">
        {sessions.overdue > 0
          ? <Badge tone="warn"><Icon name="clock" className="w-3 h-3" />{t('progress.overdueCount', { count: sessions.overdue })}</Badge>
          : <span className="cap">—</span>}
      </td>
      <td className="px-4 py-3">
        {lastSession ? (
          <>
            <div className="text-[13px]">{formatDate(lastSession.scheduledAt)} · {lastSession.type}</div>
            {(lastSession.resultMetric || lastSession.resultValue != null) && (
              <div className="cap">{lastSession.resultMetric ?? '—'} = {lastSession.resultValue ?? '—'}</div>
            )}
          </>
        ) : <span className="cap">{t('progress.noneYet')}</span>}
      </td>
      <td className="px-4 py-3">
        {nextSession ? (
          <>
            <div className="text-[13px]">{formatDateTime(nextSession.scheduledAt)}</div>
            <div className="cap">{nextSession.type}</div>
          </>
        ) : <span className="cap">{t('progress.notScheduled')}</span>}
      </td>
      <td className="px-4 py-3 text-right"><Btn sm to={`/horses/${horse.id}?tab=sessions`}>{t('progress.sessionsBtn')}</Btn></td>
    </tr>
  );
}
