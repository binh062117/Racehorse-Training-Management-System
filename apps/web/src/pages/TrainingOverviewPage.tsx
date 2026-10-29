import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { SessionStatus } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { Btn, EmptyState } from '../ds/ui';
import { usePageChrome } from '../ds/AppShell';
import '../ds/hai.css';

type Counts = Record<SessionStatus, number>;
interface Overview { total: number; counts: Counts; completion: number | null; weeks: (Counts & { week: string })[] }
const statuses: SessionStatus[] = ['PLANNED', 'DONE', 'CANCELLED', 'MISSED'];

export function TrainingOverviewPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  usePageChrome({ crumbs: [t('nav.plansTrainer'), t('hai.clubProgress')] });
  useEffect(() => {
    const controller = new AbortController();
    api.get<Overview>('/training/progress/overview', { signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) { setData(r.data); setError(null); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e); });
    return () => controller.abort();
  }, [attempt]);
  const max = Math.max(1, ...(data?.weeks.map((w) => w.DONE) ?? []));
  return <section className="hai-progress">
    <h1>{t('hai.clubProgress')}</h1>
    <p>{t('hai.completionRule')}</p>
    {error ? <><ErrorText err={error} /><Btn onClick={() => { setError(null); setAttempt((n) => n + 1); }}>{t('healthView.retry')}</Btn></> : !data ? <p role="status">{t('ui.loading')}</p> : <>
      <div className="hai-summary">
        <div className="hai-stat hai-lead">{t('hai.totalSessions')}<strong>{data.total}</strong></div>
        {statuses.map((status) => <div className="hai-stat" key={status}>{t('session.displayStatus.' + status)}<strong>{data.counts[status]}</strong></div>)}
        <div className="hai-stat">{t('hai.completion')}<strong>{data.completion === null ? '—' : `${data.completion}%`}</strong></div>
      </div>
      {data.total === 0 ? <EmptyState>{t('hai.noSessions')}</EmptyState> : <>
        <h2>{t('hai.weekly')}</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('hai.weekly')}>
        <svg className="min-w-[640px]" viewBox="0 0 640 200" role="img" aria-label={t('hai.weekly')}>
          {data.weeks.map((w, i) => <g key={w.week}>
            <rect x={i * 80 + 12} y={160 - w.DONE / max * 120} width="48" height={w.DONE / max * 120} fill="currentColor"><title>{w.week}: {w.DONE}</title></rect>
            <text x={i * 80 + 36} y={150 - w.DONE / max * 120} textAnchor="middle" fill="var(--hai-ink)">{w.DONE}</text>
            <text x={i * 80 + 36} y="184" fontSize="12" textAnchor="middle" fill="var(--hai-ink)">{w.week.slice(5)}</text>
          </g>)}
        </svg>
        </div>
        <div className="overflow-x-auto"><table>
          <caption>{t('hai.weeklyDistribution')}</caption>
          <thead><tr><th scope="col">{t('hai.week')}</th>{statuses.map((s) => <th scope="col" key={s}>{t('session.displayStatus.' + s)}</th>)}</tr></thead>
          <tbody>{data.weeks.map((w) => <tr key={w.week}><th scope="row">{w.week}</th>{statuses.map((s) => <td key={s}>{w[s]}</td>)}</tr>)}</tbody>
        </table></div>
      </>}
    </>}
  </section>;
}
