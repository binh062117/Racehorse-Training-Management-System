import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  careerTone, fitColor, healthTone,
} from '../ds/ui';

type Filter = 'all' | 'locked' | 'injured' | 'mon';
const FILTERS: [Filter, (h: Horse) => boolean][] = [
  ['all', () => true],
  ['locked', (h) => h.locked],
  ['injured', (h) => h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED'],
  ['mon', (h) => h.healthStatus === 'MONITORING'],
];
const HEALTH_DIST: { key: HealthStatus; color: string }[] = [
  { key: 'FIT', color: '#6fae84' },
  { key: 'MONITORING', color: '#e0b55a' },
  { key: 'QUARANTINED', color: '#d98080' },
  { key: 'INJURED', color: '#b94a4a' },
];

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const bySearch = debouncedSearch.trim()
    ? all.filter((h) => h.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()))
    : all;
  const rows = [...bySearch].filter(FILTERS.find((f) => f[0] === filter)![1])
    .sort((a, b) => (b.fitnessScore ?? -1) - (a.fitnessScore ?? -1));

  const locked = all.filter((h) => h.locked).length;
  const active = all.filter((h) => h.status === 'ACTIVE').length;
  const scored = all.filter((h) => h.fitnessScore != null);
  const avgFit = scored.length ? (scored.reduce((s, h) => s + (h.fitnessScore ?? 0), 0) / scored.length).toFixed(1) : '—';
  const healthCounts = HEALTH_DIST.map((d) => ({ ...d, n: all.filter((h) => h.healthStatus === d.key).length }));

  const title = personal ? t('horsePage.personalTitle') : t('horsePage.stableTitle');
  usePageChrome({ crumbs: [t('nav.horses'), title], search: t('horseFlow.searchPlaceholder'), onSearch: setSearch });

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">{t('horsePage.season')}</div>
            <h1 className="disp text-[64px] mt-2">{title}</h1>
            <p className="text-hero-muted mt-2.5 max-w-[520px]">
              {isManager
                ? t('horsePage.managerDescription')
                : personal
                  ? t('horsePage.personalDescription')
                  : t('horsePage.defaultDescription')}
            </p>
          </div>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              <Btn v="light" onClick={() => setCreateOpen(true)}><Icon name="plus" />{t('horsePage.addHorse')}</Btn>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-y-6 items-end">
          <HeroStats items={[
            { label: t('horsePage.total'), value: all.length, small: t('horsePage.horsesUnit') },
            { label: t('horsePage.racing'), value: active, small: `/ ${all.length}` },
            { label: t('horsePage.fitnessAverage'), value: avgFit },
            { label: t('horsePage.trainingLocked'), value: locked, small: t('horsePage.horsesUnit'), color: '#f3b4b4' },
          ]} />
          <div className="flex-[1_1_320px] min-w-[260px] pl-6 border-l border-white/10">
            <span className="lbl">{t('horsePage.herdHealth')}</span>
            <div className="flex gap-0.5 h-2.5 rounded overflow-hidden mt-2" role="img" aria-label={healthCounts.map((d) => `${t(`horseStatusBadge.${d.key}`)} ${d.n}`).join(', ')}>
              {healthCounts.map((d) => (
                <i key={d.key} className="block" style={{ width: all.length ? `${(d.n / all.length) * 100}%` : 0, background: d.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2 text-[11.5px] text-hero-line">
              {healthCounts.map((d) => (
                <span key={d.key} className="flex gap-1.5 items-center"><i className="w-2 h-2 rounded-sm" style={{ background: d.color }} />{t(`horseStatusBadge.${d.key}`)} <b className="text-white">{d.n}</b></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        {FILTERS.map(([k, fn]) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{t(`horsePage.filters.${k === 'mon' ? 'monitoring' : k}`)} <span className={filter === k ? 'text-hero-line' : 'text-muted'}>{bySearch.filter(fn).length}</span></Chip>
        ))}
        <div className="ml-auto flex gap-2.5 items-center">
          <span className="cap">{t('horsePage.sortFitness')}</span>
          <Seg options={ [['cards', t('horsePage.cards')], ['table', t('horsePage.table')]]} value={view} onChange={(v) => setView(v as 'cards' | 'table')} />
        </div>
      </div>

      <ErrorText err={loadErr} />

      {loading && rows.length === 0 ? (
        <p className="cap">{t('horsePage.loading')}</p>
      ) : rows.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="cap">{t('horsePage.noMatchingHorse')}</p>
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
                  {[
                    t('horsePage.columns.horse'),
                    t('horsePage.columns.owner'),
                    t('horsePage.columns.breed'),
                    t('horsePage.columns.fitness'),
                    t('horsePage.columns.status'),
                    t('horsePage.columns.health'),
                    t('horsePage.columns.trainingLock'),
                    ...(isManager ? [t('horsePage.columns.actions')] : []),
                  ].map((column) => (
                    <th key={column} className="h-[42px] px-4 bg-cream lbl border-b border-line">{column}</th>
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
                            <div className="cap num">{h.gender ? t(`horse.gender${h.gender === 'MALE' ? 'Male' : 'Female'}`) : '—'} · {age != null ? t('horsePage.age', { count: age }) : '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{h.owner.name}</td>
                      <td className="px-4 py-3">{h.breed ?? '—'}</td>
                      <td className="px-4 py-3"><b className="num" style={{ color: fitColor(h.fitnessScore) }}>{h.fitnessScore ?? '—'}</b></td>
                      <td className="px-4 py-3"><Badge tone={careerTone[h.status]}>{t(`horseStatusBadge.${h.status}`)}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={healthTone[h.healthStatus]}>{t(`horseStatusBadge.${h.healthStatus}`)}</Badge></td>
                      <td className="px-4 py-3">{h.locked ? <LockBadge>{h.lockReason ?? t('horsePage.locked')}</LockBadge> : <span className="cap">—</span>}</td>
                      {isManager && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Btn sm onClick={() => setEditingHorse(h)}><Icon name="edit" className="w-3.5 h-3.5" />{t('horsePage.edit')}</Btn>
                            <Btn sm v="d" onClick={() => setDeletingHorse(h)}><Icon name="trash" className="w-3.5 h-3.5" />{t('horsePage.delete')}</Btn>
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
      <div className="flex items-center gap-3"><span className="cap">{t('horsePage.shownCount', { shown: rows.length, total: all.length })}</span></div>

      <CreateHorseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <EditHorseModal horse={editingHorse} isOpen={editingHorse !== null} onClose={() => setEditingHorse(null)} onUpdated={load} />
      <DeleteHorseModal horse={deletingHorse} isOpen={deletingHorse !== null} onClose={() => setDeletingHorse(null)} onDeleted={load} />
    </>
  );
}

function HorseCard({ h, canManage, onEdit, onDelete }: { h: Horse; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const age = calculateAge(h.birthDate);
  const photo = getFileUrl(h.photoUrl);
  return (
    <div className={`relative flex flex-col rounded-xl border border-line overflow-hidden text-ink transition hover:border-line-strong hover:shadow-lift ${h.locked ? 'hatch' : 'bg-white'}`}>
      {h.locked && <span className="lockband" aria-hidden="true">{t('horsePage.locked')}</span>}
      <Link to={`/horses/${h.id}`} aria-label={t('horsePage.profileFor', { name: h.name })} className="flex gap-3 items-start p-4 pb-3 no-underline text-ink">
        {photo ? (
          <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-none border border-line" />
        ) : (
          <Cloth n={h.saddleNumber ?? '—'} />
        )}
        <Silk owner={h.owner.id} size={34} />
        <div className="flex-1 min-w-0"><div className="disp text-2xl leading-6 truncate">{h.name}</div><div className="cap num mt-1">{h.breed ?? t('horsePage.breedUnknown')} · {age != null ? t('horsePage.age', { count: age }) : t('horsePage.ageUnknown')}</div></div>
      </Link>
      <div className="flex items-center gap-3.5 px-4 pb-3.5">
        <Ring value={h.fitnessScore ?? 0} color={fitColor(h.fitnessScore)} text={h.fitnessScore ?? '—'} label={`${t('horsePage.fitness')} ${h.fitnessScore ?? t('horsePage.fitnessUnrated')}`} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline"><span className="lbl">{t('horsePage.fitness')}</span></div>
          <span className="cap">{h.fitnessScore != null ? `${h.fitnessScore} / 100` : t('horsePage.fitnessUnrated')}</span>
          <div className="flex items-center gap-2"><span className="lbl">{t('horsePage.gender')}</span><span className="cap">{h.gender ? t(`horse.gender${h.gender === 'MALE' ? 'Male' : 'Female'}`) : t('horsePage.genderUnknown')}</span></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
        <Badge tone={careerTone[h.status]}>{t(`horseStatusBadge.${h.status}`)}</Badge>
        <Badge tone={healthTone[h.healthStatus]}>{t(`horseStatusBadge.${h.healthStatus}`)}</Badge>
        {h.locked && <LockBadge>{h.lockReason ?? t('horsePage.locked')}</LockBadge>}
      </div>
      <div className="mt-auto flex items-center gap-2 px-4 py-2.5 border-t border-line-soft bg-subtle">
        <span className="cap flex-1 min-w-0 truncate">{t('horsePage.ownerLabel')} <b className="text-ink">{h.owner.name}</b></span>
        {canManage && (
          <div className="flex gap-1">
            <button type="button" aria-label={t('horsePage.edit')} onClick={onEdit} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-ink"><Icon name="edit" className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={t('horsePage.delete')} onClick={onDelete} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-bad"><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
