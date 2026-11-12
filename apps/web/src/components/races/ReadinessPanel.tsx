import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { HorseRaceEntry, Paginated, RaceReadiness } from '../../lib/types';
import { Badge, Card, Chip, ChipCount } from '../../ds/ui';

/**
 * Which horses may be entered in a race right now, and why not for the rest:
 * latest plan complete, vet fitness score ≥ 80, not locked / retired / quarantined.
 */
export function ReadinessPanel({ items, title }: { items: RaceReadiness[]; title: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState<'ALL' | 'READY' | 'NOT'>('ALL');
  const [expanded, setExpanded] = useState(false);
  const ready = items.filter((r) => r.ready).length;
  const list = items
    .filter((r) => (show === 'READY' ? r.ready : show === 'NOT' ? !r.ready : true))
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.horseName.localeCompare(b.horseName));
  const visible = expanded ? list : list.slice(0, 6);
  return (
    <Card className="min-w-0 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[12.5px] text-muted mt-0.5">{t('readiness.rule')}</p>
        </div>
        <div className="flex gap-1.5">
          <Chip on={show === 'ALL'} onClick={() => setShow('ALL')}>{t('readiness.all')} <ChipCount n={items.length} /></Chip>
          <Chip on={show === 'READY'} onClick={() => setShow('READY')}>{t('readiness.ready')} <ChipCount n={ready} /></Chip>
          <Chip on={show === 'NOT'} onClick={() => setShow('NOT')}>{t('readiness.notReady')} <ChipCount n={items.length - ready} /></Chip>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-muted px-5 py-4">{t('readiness.empty')}</p>
      ) : (
        <ul className="list-none m-0 p-0 mt-3 grid sm:grid-cols-2 xl:grid-cols-3 border-t border-line-soft">
          {visible.map((r) => (
            <li key={r.horseId} className="px-5 py-3 border-b border-line-soft">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/horses/${r.horseId}`} className="font-semibold text-navy no-underline hover:underline truncate">{r.horseName}</Link>
                {r.ready ? <Badge tone="ok">{t('readiness.ready')}</Badge> : <Badge tone="warn">{t('readiness.notReady')}</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-3 text-[12.5px] text-muted mt-1">
                <span>{t('readiness.fitness')}: <b className={`num ${r.fitnessScore != null && r.fitnessScore >= 80 ? 'text-ok' : 'text-warn'}`}>{r.fitnessScore ?? '—'}</b>/100</span>
                {r.latestPlan && <span>{t('readiness.plan')}: <b className="num">{r.latestPlan.done}/{r.latestPlan.total}</b></span>}
              </div>
              {!r.ready && (
                <ul className="list-disc pl-4 mt-1 text-[12.5px] text-warn-ink">
                  {r.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length > 6 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full py-2.5 text-[13px] font-medium text-info hover:bg-subtle cursor-pointer">
          {expanded ? t('readiness.less') : t('readiness.more', { n: list.length - 6 })}
        </button>
      )}
    </Card>
  );
}

/** Owner: every race their horses were entered in, with the result. */
export function OwnerResultsPanel({ horses }: { horses: RaceReadiness[] }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<(HorseRaceEntry & { horseName: string })[] | null>(null);
  const key = horses.map((h) => h.horseId).join(',');
  useEffect(() => {
    if (!key) { setRows([]); return; }
    let live = true;
    Promise.all(horses.map((h) =>
      api.get<Paginated<HorseRaceEntry>>(`/horses/${h.horseId}/race-entries`, { params: { limit: 100 } })
        .then((r) => r.data.data.map((e) => ({ ...e, horseName: h.horseName })))
        .catch(() => []),
    )).then((all) => { if (live) setRows(all.flat().sort((a, b) => b.race.date.localeCompare(a.race.date))); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="min-w-0 mb-5">
      <div className="px-5 pt-4"><h2 className="text-[15px] font-semibold">{t('readiness.myEntries')}</h2></div>
      {rows == null ? (
        <p className="text-muted px-5 py-4">{t('races.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted px-5 py-4">{t('readiness.noEntries')}</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="h-10 px-5 font-medium border-b border-line">{t('races.race')}</th>
                <th className="h-10 px-3 font-medium border-b border-line">{t('readiness.horse')}</th>
                <th className="h-10 px-3 font-medium border-b border-line">{t('races.date')}</th>
                <th className="h-10 px-5 font-medium border-b border-line">{t('readiness.result')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-2.5 font-medium">{e.race.name}<div className="text-[12px] text-muted font-normal">{e.race.venue ?? ''}</div></td>
                  <td className="px-3 py-2.5"><Link to={`/horses/${e.horseId}`} className="text-navy no-underline hover:underline">{e.horseName}</Link></td>
                  <td className="px-3 py-2.5 num whitespace-nowrap">{formatDate(e.race.date)}</td>
                  <td className="px-5 py-2.5">
                    {e.position != null
                      ? <Badge tone={e.position <= 3 ? 'ok' : 'neu'}>{t('readiness.position', { n: e.position })}{e.time ? ` · ${e.time}` : ''}</Badge>
                      : e.race.date.slice(0, 10) >= today ? <Badge tone="info">{t('races.filters.UPCOMING')}</Badge> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
