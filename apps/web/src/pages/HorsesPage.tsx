import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useEffect, useState } from 'react';
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
  Btn, Card, CareerBadge, Chip, ChipCount, Cloth, EmptyState, HealthBadge, HorseAvatar, Icon, KpiStrip,
  LockBadge, PageHeader, Ring, Seg, fitColor, lockReasonText,
} from '../ds/ui';

type Filter = 'all' | 'locked' | 'injured' | 'mon';
const FILTERS = (): [Filter, string, (h: Horse) => boolean][] => [
  ['all', i18n.t("races.filters.ALL"), () => true],
  ['locked', i18n.t("ui.trainingLocked2"), (h) => h.locked],
  ['injured', i18n.t("mergeUi.injuredOrQuarantined"), (h) => h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED'],
  ['mon', i18n.t("horseFlow.health.MONITORING"), (h) => h.healthStatus === 'MONITORING'],
];

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}
const genderText = (g: Horse['gender']) => (g === 'MALE' ? i18n.t("horse.genderMale") : g === 'FEMALE' ? i18n.t("horse.genderFemale") : i18n.t("ui.unknownSex"));
const ageText = (birthDate: string | null) => {
  const age = calculateAge(birthDate);
  return age != null ? i18n.t('ui.age', { count: age }) : i18n.t("ui.unknownAge");
};

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [healthFilter, setHealthFilter] = useState<HealthStatus | ''>('');
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
    ...(healthFilter ? { healthStatus: healthFilter } : {}),
    ...(personal && isOwner && user?.id ? { ownerId: user.id } : {}),
  };
  const cacheKey = `horses:${JSON.stringify(queryParams)}`;
  const { data, loading, error: loadErr, reload: load } = useCachedResource(cacheKey, () =>
    api.get<Paginated<Horse>>('/horses', { params: queryParams }).then((r) => r.data),
  );
  const all = data?.data ?? [];
  const q = debouncedSearch.trim().toLowerCase();
  const bySearch = q ? all.filter((h) => h.name.toLowerCase().includes(q)) : all;
  const rows = [...bySearch].filter(FILTERS().find((f) => f[0] === filter)![2])
    .sort((a, b) => (b.fitnessScore ?? -1) - (a.fitnessScore ?? -1));

  const locked = all.filter((h) => h.locked).length;
  const active = all.filter((h) => h.status === 'ACTIVE').length;
  const scored = all.filter((h) => h.fitnessScore != null);
  const avgFit = scored.length ? (scored.reduce((s, h) => s + (h.fitnessScore ?? 0), 0) / scored.length).toFixed(1) : null;
  const avgFitNum = avgFit != null ? Number(avgFit) : null;

  const title = personal ? i18n.t("horseFlow.myHorses") : i18n.t("nav.horses");
  usePageChrome({ crumbs: [title] });

  const sub = loading && all.length === 0
    ? i18n.t("ui.loadingHorses")
    : i18n.t('mergeUi.horseSummary', { count: all.length, locked: locked > 0 ? i18n.t('mergeUi.lockedSummary', { count: locked }) : '', owned: personal ? i18n.t('mergeUi.ownedSuffix') : '' });

  return (
    <>
      <PageHeader
        title={title}
        sub={sub}
        search={{ placeholder: i18n.t("horseFlow.searchPlaceholder"), value: search, onChange: setSearch }}
        actions={isManager ? <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />{i18n.t("horse.new")}</Btn> : undefined}
      />

      <KpiStrip items={[
        { label: i18n.t("dashboard.totalHorses"), value: all.length },
        { label: i18n.t("ui.active"), value: active, unit: `/ ${all.length}` },
        { label: i18n.t("mergeUi.averageFitness"), value: avgFitNum ?? '—', unit: avgFit ? '/100' : undefined, sub: scored.length < all.length ? i18n.t('mergeUi.assessedHorses', { count: scored.length, total: all.length }) : undefined },
        { label: i18n.t("mergeUi.locked"), value: locked, tone: locked > 0 ? 'bad' : undefined },
      ]} />

      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS().map(([k, l, fn]) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{l} <ChipCount n={bySearch.filter(fn).length} /></Chip>
        ))}
        <select className="h-9 w-auto rounded-btn border border-line-strong bg-white px-3" aria-label={i18n.t('ui.healthStatus')} value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as HealthStatus | '')}>
          <option value="">{i18n.t('healthView.all')}</option>
          {(['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] as const).map((status) => <option key={status} value={status}>{i18n.t('horseStatusBadge.' + status)}</option>)}
        </select>
        <div className="ml-auto"><Seg options={[['cards', i18n.t("ui.cards")], ['table', i18n.t("ui.table")]]} value={view} onChange={(v) => setView(v as 'cards' | 'table')} /></div>
      </div>

      <ErrorText err={loadErr} />

      {loading && rows.length === 0 ? (
        <p className="text-muted">{i18n.t("ui.loadingHorses")}</p>
      ) : rows.length === 0 ? (
        <EmptyState action={filter !== 'all' || healthFilter || q ? <Btn sm onClick={() => { setFilter('all'); setHealthFilter(''); setSearch(''); }}>{i18n.t("mergeUi.clearFilters")}</Btn> : undefined}>
          {all.length === 0 ? i18n.t("mergeUi.noHorses") : i18n.t("mergeUi.noMatches")}
        </EmptyState>
      ) : view === 'cards' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(290px, 100%), 1fr))' }}>
          {rows.map((h) => <HorseCard key={h.id} h={h} canManage={isManager} onEdit={() => setEditingHorse(h)} onDelete={() => setDeletingHorse(h)} />)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-10 px-5 font-medium border-b border-line">{i18n.t("incidents.horse")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("ui.owner2")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("horse.breed")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line text-right">{i18n.t("mergeUi.fitness")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("mergeUi.racing")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("ui.health")}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("ui.trainingLocked2")}</th>
                  {isManager && <th className="h-10 px-5 border-b border-line" aria-label={i18n.t("incidents.actions")} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 flex justify-center"><Cloth n={h.saddleNumber} /></span>
                        <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={32} />
                        <div className="min-w-0">
                          <Link to={`/horses/${h.id}`} className="font-medium text-ink no-underline hover:text-info">{h.name}</Link>
                          <div className="text-[12.5px] text-muted">{genderText(h.gender)} · {ageText(h.birthDate)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{h.owner.name}</td>
                    <td className="px-4 py-3 text-muted">{h.breed ?? '—'}</td>
                    <td className="px-4 py-3 text-right num">
                      {h.fitnessScore != null ? <span className="font-semibold hop" style={{ color: fitColor(h.fitnessScore) }}>{h.fitnessScore}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3"><CareerBadge status={h.status} /></td>
                    <td className="px-4 py-3"><HealthBadge status={h.healthStatus} /></td>
                    <td className="px-4 py-3 max-w-[260px]">
                      {h.locked
                        ? <div className="flex flex-col gap-1 items-start"><LockBadge /><span className="text-[12.5px] text-muted line-clamp-1" title={lockReasonText(h.lockReason)}>{lockReasonText(h.lockReason)}</span></div>
                        : <span className="text-muted">—</span>}
                    </td>
                    {isManager && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Sửa ${h.name}`} onClick={() => setEditingHorse(h)} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream hover:text-ink"><Icon name="edit" /></button>
                          <button type="button" aria-label={`Xóa ${h.name}`} onClick={() => setDeletingHorse(h)} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-bad-bg hover:text-bad"><Icon name="trash" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {rows.length > 0 && <p className="text-[13px] text-muted">{i18n.t('mergeUi.horseRows', { count: rows.length, total: all.length })}</p>}

      <CreateHorseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <EditHorseModal horse={editingHorse} isOpen={editingHorse !== null} onClose={() => setEditingHorse(null)} onUpdated={load} />
      <DeleteHorseModal horse={deletingHorse} isOpen={deletingHorse !== null} onClose={() => setDeletingHorse(null)} onDeleted={load} />
    </>
  );
}

function HorseCard({ h, canManage, onEdit, onDelete }: { h: Horse; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  useTranslation();
  return (
    <div className="group lift hover-hop flex flex-col bg-white rounded-card border border-line hover:border-line-strong">
      <Link to={`/horses/${h.id}`} aria-label={`Hồ sơ ${h.name}`} className="flex gap-3 items-center px-4 pt-4 no-underline text-ink">
        <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold leading-5 truncate group-hover:text-info">{h.name}</span>
            <Cloth n={h.saddleNumber} />
          </div>
          <div className="text-[12.5px] text-muted mt-0.5 truncate">{h.breed ?? i18n.t("ui.unknownBreed2")} · {ageText(h.birthDate)}</div>
        </div>
      </Link>

      <div className="flex items-center gap-3 px-4 pt-4">
        <Ring value={h.fitnessScore ?? 0} size={44} color={fitColor(h.fitnessScore)} text={h.fitnessScore ?? '—'} label={`Thể lực ${h.fitnessScore ?? i18n.t("ui.notAssessed2")}`} />
        <div className="min-w-0">
          <div className="text-[13px] text-muted">{i18n.t("mergeUi.fitness")}</div>
          <div className="text-[13.5px]">{h.fitnessScore != null ? <><span className="num font-medium">{h.fitnessScore}</span><span className="text-muted"> / 100</span></> : <span className="text-muted">{i18n.t("ui.notAssessed")}</span>}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        <CareerBadge status={h.status} />
        <HealthBadge status={h.healthStatus} />
        {h.locked && <LockBadge />}
      </div>
      {h.locked && <p className="px-4 pt-2 text-[12.5px] text-bad-ink line-clamp-2" title={lockReasonText(h.lockReason)}>{lockReasonText(h.lockReason)}</p>}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 px-4 h-11 border-t border-line-soft">
          <span className="text-[13px] text-muted flex-1 min-w-0 truncate">{i18n.t("ui.owner2")}<span className="text-ink">{h.owner.name}</span></span>
          {canManage && (
            <div className="flex gap-0.5 -mr-1.5">
              <button type="button" aria-label={`Sửa ${h.name}`} onClick={onEdit} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream hover:text-ink"><Icon name="edit" /></button>
              <button type="button" aria-label={`Xóa ${h.name}`} onClick={onDelete} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-bad-bg hover:text-bad"><Icon name="trash" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
