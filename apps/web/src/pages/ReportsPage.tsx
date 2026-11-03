import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, HorseReport, Paginated } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { PlanProgressCell } from '../components/training/PlanProgress';
import { MediaStrip } from './horse/SessionsTab';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, CardHeader, EmptyState, Field, Icon, Input, KpiStrip, NativeSelect, PageHeader, lockReasonText } from '../ds/ui';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Flow 3 — the owner's monthly report for one horse: who examined it, what it
 * ate and what that cost, how training went, races, readiness and pictures.
 */
export function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  usePageChrome({ crumbs: [t('report.title')] });

  const { data: horses } = useCachedResource(`report-horses:${user?.id ?? 'anon'}`, () =>
    api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } }).then((r) => r.data.data),
  );
  const horseId = params.get('horseId') ?? horses?.[0]?.id ?? '';
  const month = params.get('month') ?? thisMonth();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    if (k !== 'horseId' && !next.get('horseId') && horseId) next.set('horseId', horseId);
    setParams(next, { replace: true });
  };

  const [report, setReport] = useState<HorseReport | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!horseId) return;
    let live = true;
    setLoading(true);
    setErr(null);
    api.get<HorseReport>(`/horses/${horseId}/report`, { params: { month } })
      .then((r) => { if (live) setReport(r.data); })
      .catch((e) => { if (live) { setErr(e); setReport(null); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [horseId, month]);

  const r = report;
  return (
    <>
      <PageHeader
        title={t('report.title')}
        sub={r ? t('report.sub', { horse: r.horse.name, month: r.month }) : t('report.pick')}
        actions={r ? <Btn onClick={() => window.print()}><Icon name="download" />{t('report.print')}</Btn> : undefined}
      />

      <div className="flex flex-wrap gap-3 items-end print:hidden">
        <Field label={t('report.horse')}>
          <NativeSelect value={horseId} onChange={(e) => set('horseId', e.target.value)} className="min-w-[220px]">
            {(horses ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('report.month')}>
          <Input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && set('month', e.target.value)} />
        </Field>
      </div>

      <ErrorText err={err} />
      {horses && horses.length === 0 && <EmptyState>{t('report.noHorses')}</EmptyState>}
      {loading && !r && <p className="cap">{t('ui.loading')}</p>}

      {r && (
        <div className={`flex flex-col gap-5 ${loading ? 'opacity-60' : ''}`}>
          <KpiStrip items={[
            { label: t('report.kpiFeedCost'), value: vnd(r.feeding.totalCostVnd), lead: true },
            { label: t('report.kpiExams'), value: r.health.exams.length },
            { label: t('report.kpiSessions'), value: `${r.training.done}/${r.training.sessions}`, tone: r.training.missed > 0 ? 'warn' : undefined, sub: r.training.missed > 0 ? t('report.missed', { n: r.training.missed }) : undefined },
            { label: t('report.kpiFitness'), value: r.horse.fitnessScore ?? '—', unit: r.horse.fitnessScore != null ? '/100' : undefined, tone: r.horse.fitnessScore != null && r.horse.fitnessScore >= 80 ? 'ok' : 'warn' },
          ]} />

          <Card>
            <CardHeader title={t('report.status')}>
              <Link to={`/horses/${r.horse.id}`} className="text-[13px] font-medium text-info no-underline">{t('report.openHorse')}</Link>
            </CardHeader>
            <div className="px-5 py-4 grid gap-3 md:grid-cols-2">
              <div>
                {r.horse.locked
                  ? <Badge tone="bad">{t('horseState.locked')}</Badge>
                  : r.readiness.ready ? <Badge tone="ok">{t('horseState.ready')}</Badge> : <Badge tone="info">{t('horseState.training')}</Badge>}
                {r.horse.locked && <p className="text-[13px] mt-1.5">{lockReasonText(r.horse.lockReason)}</p>}
                {!r.readiness.ready && (
                  <ul className="list-disc pl-4 mt-2 text-[13px] text-muted">
                    {r.readiness.reasons.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                )}
              </div>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[13.5px]">
                <dt className="text-muted">{t('report.owner')}</dt><dd>{r.horse.owner.name}</dd>
                <dt className="text-muted">{t('report.trainer')}</dt><dd>{r.horse.trainer?.name ?? '—'}</dd>
                <dt className="text-muted">{t('report.groom')}</dt><dd>{r.horse.groom?.name ?? '—'}</dd>
                <dt className="text-muted">{t('report.vets')}</dt><dd>{r.health.vets.length ? r.health.vets.join(', ') : '—'}</dd>
              </dl>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2 items-start">
            <Card>
              <CardHeader title={t('report.health')}><span className="num text-[13px] text-muted">{r.health.exams.length}</span></CardHeader>
              {r.health.exams.length === 0 && r.health.incidents.length === 0 ? (
                <p className="px-5 py-4 text-muted">{t('report.noHealth')}</p>
              ) : (
                <ul className="list-none m-0 p-0">
                  {r.health.exams.map((e) => (
                    <li key={e.id} className="px-5 py-3 border-b border-line-soft last:border-0">
                      <div className="flex justify-between gap-2"><span className="font-medium">{e.diagnosis}</span><span className="num text-[12.5px] text-muted">{formatDate(e.examDate)}</span></div>
                      <div className="text-[12.5px] text-muted mt-0.5">{t('report.examinedBy', { name: e.vet.name })}{e.treatment ? ` · ${e.treatment}` : ''}</div>
                    </li>
                  ))}
                  {r.health.incidents.map((i) => (
                    <li key={i.id} className="px-5 py-3 border-b border-line-soft last:border-0">
                      <div className="flex justify-between gap-2">
                        <span><Badge tone={i.severity === 'HIGH' ? 'bad' : i.severity === 'MEDIUM' ? 'warn' : 'neu'}>{t(`incidents.severities.${i.severity}`)}</Badge> <span className="ml-1">{i.description}</span></span>
                        <span className="num text-[12.5px] text-muted whitespace-nowrap">{formatDate(i.createdAt)}</span>
                      </div>
                      <div className="text-[12.5px] text-muted mt-0.5">{t(`incidents.status.${i.status}`)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title={t('report.feeding')}><span className="num text-[13px] font-semibold">{vnd(r.feeding.totalCostVnd)}</span></CardHeader>
              {r.feeding.meals === 0 ? (
                <p className="px-5 py-4 text-muted">{t('report.noFeeding')}</p>
              ) : (
                <>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left text-[12px] text-muted">
                        <th className="h-9 px-5 font-medium border-b border-line">{t('feeding.thFeedType', 'Loại thức ăn')}</th>
                        <th className="h-9 px-3 font-medium border-b border-line text-right">{t('report.meals')}</th>
                        <th className="h-9 px-3 font-medium border-b border-line text-right">kg</th>
                        <th className="h-9 px-5 font-medium border-b border-line text-right">{t('feeding.thCost')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.feeding.byFeed.map((f) => (
                        <tr key={f.feedType} className="border-b border-line-soft last:border-0">
                          <td className="px-5 py-2.5">{f.feedType}</td>
                          <td className="px-3 py-2.5 num text-right">{f.meals}</td>
                          <td className="px-3 py-2.5 num text-right">{Math.round(f.kg * 10) / 10}</td>
                          <td className="px-5 py-2.5 num text-right">{vnd(f.costVnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {r.feeding.uncostedMeals > 0 && <p className="px-5 py-2.5 text-[12.5px] text-muted border-t border-line-soft">{t('report.uncosted', { n: r.feeding.uncostedMeals })}</p>}
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 items-start">
            <Card>
              <CardHeader title={t('report.training')}>
                {r.training.avgFinishTimeSec != null && <span className="text-[12.5px] text-muted">{t('report.avgFinish', { s: r.training.avgFinishTimeSec })}</span>}
              </CardHeader>
              {r.training.plans.length === 0 ? (
                <p className="px-5 py-4 text-muted">{t('report.noPlans')}</p>
              ) : (
                <ul className="list-none m-0 p-0">
                  {r.training.plans.map((p) => (
                    <li key={p.id} className="px-5 py-3 border-b border-line-soft last:border-0">
                      <div className="flex justify-between gap-2"><span className="font-medium">{p.goal}</span><span className="text-[12.5px] text-muted">{p.trainer}</span></div>
                      <div className="mt-1.5"><PlanProgressCell plan={p} /></div>
                    </li>
                  ))}
                </ul>
              )}
              {r.training.assessments.length > 0 && (
                <div className="px-5 py-3 border-t border-line-soft text-[13px]">
                  <div className="lbl mb-1">{t('report.assessments')}</div>
                  {r.training.assessments.map((a) => (
                    <div key={a.createdAt} className="flex justify-between gap-2">
                      <span>{a.assessedBy.name} · <span className="num text-muted">{formatDate(a.createdAt)}</span></span>
                      <b className={`num ${a.totalScore >= 80 ? 'text-ok' : 'text-warn'}`}>{a.totalScore}/100</b>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title={t('report.races')} />
              {r.races.length === 0 ? (
                <p className="px-5 py-4 text-muted">{t('readiness.noEntries')}</p>
              ) : (
                <ul className="list-none m-0 p-0">
                  {r.races.map((e) => (
                    <li key={e.id} className="px-5 py-3 border-b border-line-soft last:border-0 flex justify-between gap-2">
                      <span><span className="font-medium">{e.race.name}</span><span className="block text-[12.5px] text-muted num">{formatDate(e.race.date)}{e.race.venue ? ` · ${e.race.venue}` : ''}</span></span>
                      {e.position != null ? <Badge tone={e.position <= 3 ? 'ok' : 'neu'}>{t('readiness.position', { n: e.position })}</Badge> : <span className="text-muted">—</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title={t('report.media')}><span className="num text-[13px] text-muted">{r.media.length}</span></CardHeader>
            <div className="px-5 pb-4">
              {r.media.length === 0 ? <p className="pt-4 text-muted">{t('report.noMedia')}</p> : <MediaStrip media={r.media} />}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
