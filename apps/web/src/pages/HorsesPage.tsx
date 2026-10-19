import i18n from '../i18n';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HealthStatusBadge } from '../components/health/HealthStatusBadge';
import { Link } from 'react-router-dom';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, HealthStatus, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHorseModal } from '../components/horse/CreateHorseModal';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, Chip, Cloth, HeroStats, Icon, LockBadge, Ring, Seg, Silk,
  careerTone, fitColor,
} from '../ds/ui';

type Filter = 'all' | 'locked' | HealthStatus;
const FILTERS: Filter[] = ['all', 'locked', 'FIT', 'MONITORING', 'INJURED', 'QUARANTINED'];
const HEALTH_DIST: () => { key: HealthStatus; label: string; color: string }[] = () => ([
  { key: 'FIT', label: i18n.t("horseStatusBadge.FIT"), color: '#6fae84' },
  { key: 'MONITORING', label: i18n.t("horseStatusBadge.MONITORING"), color: '#e0b55a' },
  { key: 'QUARANTINED', label: i18n.t("horseStatusBadge.QUARANTINED"), color: '#d98080' },
  { key: 'INJURED', label: i18n.t("horseStatusBadge.INJURED"), color: '#b94a4a' },
]);

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [deletingHorse, setDeletingHorse] = useState<Horse | null>(null);

  const queryParams = {
    limit: 100,
    ...(personal && isOwner && user?.id ? { ownerId: user.id } : {}),
  };
  const cacheKey = `horses:${JSON.stringify(queryParams)}`;
  const { data, loading, error: loadErr, reload: load } = useCachedResource(cacheKey, () =>
    api.get<Paginated<Horse>>('/horses', { params: queryParams }).then((r) => r.data),
  );
  const all = data?.data ?? [];
  const healthFilter = filter === 'all' || filter === 'locked' ? null : filter;
  const [healthResult, setHealthResult] = useState<{ status: HealthStatus; source: typeof data; rows: Horse[]; err: unknown } | null>(null);
  useEffect(() => {
    if (!healthFilter) return;
    let active = true;
    api.get<Paginated<Horse>>('/horses', { params: { ...queryParams, healthStatus: healthFilter } })
      .then((r) => { if (active) setHealthResult({ status: healthFilter, source: data, rows: r.data.data, err: null }); })
      .catch((err: unknown) => { if (active) setHealthResult({ status: healthFilter, source: data, rows: [], err }); });
    return () => { active = false; };
  // Query parameters are captured by the existing cache key; data refreshes after horse edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthFilter, cacheKey, data]);
  const healthCurrent = healthResult?.status === healthFilter && healthResult?.source === data;
  const source = healthFilter ? (healthCurrent ? healthResult!.rows : []) : all;
  const healthLoading = !!healthFilter && !healthCurrent;
  const bySearch = debouncedSearch.trim()
    ? source.filter((h) => h.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()))
    : source;
  const rows = [...bySearch].filter((h) => filter !== 'locked' || h.locked)
    .sort((a, b) => (b.fitnessScore ?? -1) - (a.fitnessScore ?? -1));

  const locked = all.filter((h) => h.locked).length;
  const active = all.filter((h) => h.status === 'ACTIVE').length;
  const scored = all.filter((h) => h.fitnessScore != null);
  const avgFit = scored.length ? (scored.reduce((s, h) => s + (h.fitnessScore ?? 0), 0) / scored.length).toFixed(1) : '—';
  const healthCounts = HEALTH_DIST().map((d) => ({ ...d, label: t(`horseStatusBadge.${d.key}`), n: all.filter((h) => h.healthStatus === d.key).length }));

  const title = personal ? i18n.t("nav.horsesOwner") : i18n.t("ui.stables");
  usePageChrome({ crumbs: [i18n.t("nav.horses"), title], search: i18n.t("ui.searchHorseName"), onSearch: setSearch });

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">{i18n.t("ui.2026SeasonRacehorseClub")}</div>
            <h1 className="disp text-[64px] mt-2">{title}</h1>
            <p className="text-hero-muted mt-2.5 max-w-[520px]">
              {isManager
                ? i18n.t("ui.clubHorsesCurrentOperationalStatusHealthAndFitness")
                : personal
                  ? i18n.t("ui.horsesOwnedByYou")
                  : i18n.t("ui.horsesVisibleToYourRole")}
            </p>
          </div>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              <Btn v="light" onClick={() => setCreateOpen(true)}><Icon name="plus" />{i18n.t("horse.new")}</Btn>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-y-6 items-end">
          <HeroStats items={[
            { label: i18n.t("ui.loadedHorses2"), value: all.length, small: i18n.t("ui.horses2") },
            { label: i18n.t("ui.active"), value: active, small: `/ ${all.length}` },
            { label: i18n.t("ui.averageFitnessScore"), value: avgFit },
            { label: i18n.t("ui.trainingLocked2"), value: locked, small: i18n.t("ui.horses2"), color: '#f3b4b4' },
          ]} />
          <div className="flex-[1_1_320px] min-w-[260px] pl-6 border-l border-white/10">
            <span className="lbl">{i18n.t("ui.herdHealth")}</span>
            <div className="flex gap-0.5 h-2.5 rounded overflow-hidden mt-2" role="img" aria-label={healthCounts.map((d) => `${d.label} ${d.n}`).join(', ')}>
              {healthCounts.map((d) => (
                <i key={d.key} className="block" style={{ width: all.length ? `${(d.n / all.length) * 100}%` : 0, background: d.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2 text-[11.5px] text-hero-line">
              {healthCounts.map((d) => (
                <span key={d.key} className="flex gap-1.5 items-center"><i className="w-2 h-2 rounded-sm" style={{ background: d.color }} />{d.label} <b className="text-white">{d.n}</b></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        {FILTERS.map((k) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{t(k === 'all' ? 'healthView.all' : k === 'locked' ? 'healthView.locked' : `horseStatusBadge.${k}`)}</Chip>
        ))}
        <div className="ml-auto flex gap-2.5 items-center">
          <span className="cap">{i18n.t("ui.sortFitnessScore")}</span>
          <Seg options={[['cards', i18n.t("ui.cards")], ['table', i18n.t("ui.table")]]} value={view} onChange={(v) => setView(v as 'cards' | 'table')} />
        </div>
      </div>

      <p className="cap">{t(healthFilter ? 'healthView.filterLimit' : 'healthView.subset')}</p>
      <ErrorText err={loadErr || (healthFilter ? healthResult?.err : null)} />
      {!!(loadErr || (healthFilter && healthResult?.err)) && <Btn className="self-start" onClick={() => void load()}>{t('healthView.retry')}</Btn>}

      {(loading || healthLoading) && rows.length === 0 ? (
        <p className="cap">{t('healthView.loading')}</p>
      ) : rows.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="cap">{t('healthView.empty')}</p>
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' }}>
          {rows.map((h) => <HorseCard key={h.id} h={h} canManage={isManager} onEdit={() => setEditingHorse(h)} onDelete={() => setDeletingHorse(h)} />)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[i18n.t("healthSchedule.horse"), i18n.t("ui.owner2"), i18n.t("horse.breed"), i18n.t("horseFlow.fitnessScore"), i18n.t("horse.status"), i18n.t("ui.health"), i18n.t("ui.trainingLocked2"), ...(isManager ? [i18n.t("incidents.actions")] : [])].map((t) => (
                    <th key={t} className="h-[42px] px-4 bg-cream lbl border-b border-line">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const age = calculateAge(h.birthDate);
                  return (
                    <tr key={h.id} className={`border-b border-line-soft hover:bg-subtle ${h.locked ? 'bg-[#fdfbfb]' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Cloth n={h.saddleNumber ?? '—'} /><Silk owner={h.owner.id} />
                          <div>
                            <Link to={`/horses/${h.id}`} className="font-semibold text-ink no-underline">{h.name}</Link>
                            <div className="cap num">{h.gender === 'MALE' ? i18n.t("horse.genderMale") : h.gender === 'FEMALE' ? i18n.t("horse.genderFemale") : '—'} · {age != null ? i18n.t('ui.age', { count: age }) : '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{h.owner.name}</td>
                      <td className="px-4 py-3">{h.breed ?? '—'}</td>
                      <td className="px-4 py-3"><b className="num" style={{ color: fitColor(h.fitnessScore) }}>{h.fitnessScore ?? '—'}</b></td>
                      <td className="px-4 py-3"><Badge tone={careerTone[h.status]}>{i18n.t(`horseStatusBadge.${h.status}`)}</Badge></td>
                      <td className="px-4 py-3"><HealthStatusBadge status={h.healthStatus} /></td>
                      <td className="px-4 py-3">{h.locked ? <LockBadge>{h.lockReason ?? i18n.t("ui.locked")}</LockBadge> : <span className="cap">—</span>}</td>
                      {isManager && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Btn sm onClick={() => setEditingHorse(h)}><Icon name="edit" className="w-3.5 h-3.5" />{i18n.t("ui.edit")}</Btn>
                            <Btn sm v="d" onClick={() => setDeletingHorse(h)}><Icon name="trash" className="w-3.5 h-3.5" />{i18n.t("ui.delete")}</Btn>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="flex items-center gap-3"><span className="cap">{i18n.t("ui.showing")}{' '}{rows.length} / {source.length} {' '}{i18n.t("ui.horses2")}</span></div>

      <CreateHorseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <EditHorseModal horse={editingHorse} isOpen={editingHorse !== null} onClose={() => setEditingHorse(null)} onUpdated={load} />
      <DeleteHorseModal horse={deletingHorse} isOpen={deletingHorse !== null} onClose={() => setDeletingHorse(null)} onDeleted={load} />
    </>
  );
}

function HorseCard({ h, canManage, onEdit, onDelete }: { h: Horse; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  useTranslation();
  const age = calculateAge(h.birthDate);
  const photo = getFileUrl(h.photoUrl);
  return (
    <div className={`relative flex flex-col rounded-xl border border-line overflow-hidden text-ink transition hover:border-line-strong hover:shadow-lift ${h.locked ? 'hatch' : 'bg-white'}`}>
      {h.locked && <span className="lockband" aria-hidden="true">{i18n.t("ui.locked2")}</span>}
      <Link to={`/horses/${h.id}`} aria-label={i18n.t('ui.horseProfileNamed', { name: h.name })} className="flex gap-3 items-start p-4 pb-3 no-underline text-ink">
        {photo ? (
          <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-none border border-line" />
        ) : (
          <Cloth n={h.saddleNumber ?? '—'} />
        )}
        <Silk owner={h.owner.id} size={34} />
        <div className="flex-1 min-w-0"><div className="disp text-2xl leading-6 truncate">{h.name}</div><div className="cap num mt-1">{h.breed ?? i18n.t("ui.unknownBreed2")} · {age != null ? i18n.t('ui.age', { count: age }) : i18n.t("ui.unknownAge")}</div></div>
      </Link>
      <div className="flex items-center gap-3.5 px-4 pb-3.5">
        <Ring value={h.fitnessScore ?? 0} color={fitColor(h.fitnessScore)} text={h.fitnessScore ?? '—'} label={i18n.t('ui.fitnessNamed', { value: h.fitnessScore ?? i18n.t('ui.notAssessed2') })} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline"><span className="lbl">{i18n.t("ui.fitness")}</span></div>
          <span className="cap">{h.fitnessScore != null ? `${h.fitnessScore} / 100` : i18n.t("ui.notAssessed")}</span>
          <div className="flex items-center gap-2"><span className="lbl">{i18n.t("horse.gender")}</span><span className="cap">{h.gender === 'MALE' ? i18n.t("horse.genderMale") : h.gender === 'FEMALE' ? i18n.t("horse.genderFemale") : i18n.t("horse.genderUnknown")}</span></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
        <Badge tone={careerTone[h.status]}>{i18n.t(`horseStatusBadge.${h.status}`)}</Badge>
        <HealthStatusBadge status={h.healthStatus} />
        {h.locked && <LockBadge>{h.lockReason ?? i18n.t("ui.locked")}</LockBadge>}
      </div>
      <div className="mt-auto flex items-center gap-2 px-4 py-2.5 border-t border-line-soft bg-subtle">
        <span className="cap flex-1 min-w-0 truncate">{i18n.t("ui.owner2")}{' '}<b className="text-ink">{h.owner.name}</b></span>
        {canManage && (
          <div className="flex gap-1">
            <button type="button" aria-label={i18n.t("ui.edit")} onClick={onEdit} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-ink"><Icon name="edit" className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={i18n.t("ui.delete")} onClick={onDelete} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-bad"><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
