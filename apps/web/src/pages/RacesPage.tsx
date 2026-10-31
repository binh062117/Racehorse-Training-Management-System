import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { fetchAll } from '../lib/pagination';
import { api } from '../lib/api';
import { formatDate, toDateInput } from '../lib/format';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Race, RaceDetail, RaceEntry, RaceEntryStatus } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Chip, EmptyState, Field, Icon, Input, NativeSelect, PageHeader, Pagination } from '../ds/ui';

type RaceFilter = 'ALL' | 'UPCOMING' | 'PAST';
const EMPTY_RACES: Race[] = [];
const EMPTY_HORSES: Horse[] = [];

function isUpcomingRace(race: Pick<Race, 'date'>): boolean {
  return new Date(race.date).getTime() > new Date().getTime();
}

export function RacesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === 'MANAGER';
  const [selectedRace, setSelectedRace] = useState<RaceDetail | null>(null);
  const [chosenFilter, setFilter] = useState<RaceFilter>('ALL');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  usePageChrome({ crumbs: [t('races.title')] });

  const { data: raceData, loading, error, reload: loadRaces } = useCachedResource(
    `race-management-${user?.id ?? 'anonymous'}-${canManage}-${page}-${chosenFilter}-${search}`,
    async () => {
      const raceResponse = await api.get<Paginated<Race>>('/races', {
        params: { page, limit: 20, search,
          ...(chosenFilter === 'UPCOMING' ? { from: new Date().toISOString() }
            : chosenFilter === 'PAST' ? { to: new Date().toISOString() } : {}),
        },
      });
      return { races: raceResponse.data.data, total: raceResponse.data.meta.total };
    },
  );
  const races = raceData?.races ?? EMPTY_RACES;
  const { data: horseData } = useCachedResource(
    `race-horse-options-${user?.id ?? 'anonymous'}-${canManage}`,
    () => canManage ? fetchAll<Horse>('/horses') : Promise.resolve([]),
  );
  const horses = horseData ?? EMPTY_HORSES;

  const filter = chosenFilter;
  const visibleRaces = races;

  const openRace = async (race: Race) => {
    setSelectedRace(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await api.get<RaceDetail>(`/races/${race.id}`);
      setSelectedRace(response.data);
    } catch (reason) {
      setDetailError(reason);
    } finally {
      setDetailLoading(false);
    }
  };

  const onRaceSaved = async (race: Race) => {
    setFormOpen(false);
    setEditingRace(null);
    await loadRaces();
    await openRace(race);
  };

  const editRace = () => {
    if (!selectedRace) return;
    setEditingRace(selectedRace);
    setFormOpen(true);
  };

  const onEntrySaved = async () => {
    if (selectedRace) await openRace(selectedRace);
  };

  const sub = loading ? t('races.loading') : `${raceData?.total ?? 0} ${t('races.title')}`;

  return (
    <>
      <PageHeader
        title={t('races.title')}
        sub={sub}
        search={{ placeholder: t('races.search'), value: search, onChange: (value) => { setSearch(value); setPage(1); } }}
        actions={canManage ? (
          <Btn v="p" onClick={() => { setEditingRace(null); setFormOpen((open) => !open); }}>
            <Icon name={formOpen && !editingRace ? 'x' : 'plus'} />{formOpen && !editingRace ? t('races.closeForm') : t('races.createRace')}
          </Btn>
        ) : undefined}
      />

      {formOpen && canManage && (
        <RaceForm key={editingRace?.id ?? 'new-race'} race={editingRace} onCancel={() => { setFormOpen(false); setEditingRace(null); }} onSaved={onRaceSaved} />
      )}

      <ErrorText err={error} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] items-start">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <h2 className="text-[15px] font-semibold">{t('races.schedule')}</h2>
            <div className="flex gap-1.5" role="group" aria-label={t('races.filter')}>
              {(['UPCOMING', 'ALL', 'PAST'] as const).map((value) => (
                <Chip key={value} on={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{t(`races.filters.${value}`)}</Chip>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-muted px-5 py-4">{t('races.loading')}</p>
          ) : visibleRaces.length === 0 ? (
            <div className="p-5"><EmptyState>{races.length === 0 ? t('races.emptyDescription') : t('races.noMatch')}</EmptyState></div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th className="h-10 px-5 font-medium border-b border-line">{t('races.race')}</th>
                    <th className="h-10 px-3 font-medium border-b border-line">{t('races.date')}</th>
                    <th className="h-10 px-3 font-medium border-b border-line">{t('races.venue')}</th>
                    <th className="h-10 px-3 font-medium border-b border-line text-right">{t('races.distance')}</th>
                    <th className="h-10 px-5 font-medium border-b border-line">{t('races.statusLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRaces.map((race) => {
                    const isUpcoming = isUpcomingRace(race);
                    const isSelected = selectedRace?.id === race.id;
                    return (
                      <tr key={race.id} onClick={() => void openRace(race)} className={`border-b border-line-soft last:border-0 cursor-pointer ${isSelected ? 'bg-cream' : 'hover:bg-subtle'}`}>
                        <td className="px-5 py-3">
                          <button type="button" onClick={(e) => { e.stopPropagation(); void openRace(race); }} className="font-medium text-ink text-left hover:text-info">{race.name}</button>
                          <div className="text-[12.5px] text-muted">{race.surface || t('races.surfaceNotSet')}</div>
                        </td>
                        <td className="px-3 py-3 num whitespace-nowrap">{formatDate(race.date)}</td>
                        <td className="px-3 py-3">{race.venue || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-3 num text-right whitespace-nowrap">{race.distance ? <>{race.distance.toLocaleString('vi-VN')}<span className="text-muted"> m</span></> : <span className="text-muted">—</span>}</td>
                        <td className="px-5 py-3"><Badge tone={isUpcoming ? 'ok' : 'neu'}>{isUpcoming ? t('races.filters.UPCOMING') : t('races.filters.PAST')}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} limit={20} total={raceData?.total ?? 0} onChange={setPage} className="p-4" />
        </Card>

        <Card className="min-w-0 p-5" aria-live="polite">
          {detailLoading ? (
            <p className="cap">{t('races.loadingDetails')}</p>
          ) : detailError ? (
            <ErrorText err={detailError} />
          ) : selectedRace ? (
            <>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0"><p className="lbl">{t('races.raceDetails')}</p><h2 className="text-[18px] leading-6 font-semibold mt-0.5">{selectedRace.name}</h2></div>
                {canManage && <Btn sm onClick={editRace}><Icon name="edit" className="w-3.5 h-3.5" />{t('races.editRace')}</Btn>}
              </div>
              <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 mt-4">
                <dt className="text-muted">{t('races.date')}</dt><dd className="m-0 num">{formatDate(selectedRace.date)}</dd>
                <dt className="text-muted">{t('races.venue')}</dt><dd className="m-0">{selectedRace.venue || <span className="text-muted">—</span>}</dd>
                <dt className="text-muted">{t('races.distance')}</dt><dd className="m-0 num">{selectedRace.distance ? `${selectedRace.distance.toLocaleString('vi-VN')} m` : <span className="text-muted">—</span>}</dd>
                <dt className="text-muted">{t('races.surface')}</dt><dd className="m-0">{selectedRace.surface || <span className="text-muted">—</span>}</dd>
                <dt className="text-muted">{t('races.prizePool')}</dt><dd className="m-0 num">{selectedRace.prizePool == null ? <span className="text-muted">—</span> : `${selectedRace.prizePool.toLocaleString('vi-VN')} ₫`}</dd>
              </dl>

              {canManage && new Date(selectedRace.date).getTime() - new Date().getTime() >= 3 * 86400000 && (
                <AddEntryForm horses={horses} enteredHorseIds={selectedRace.entries.map((entry) => entry.horseId)} onAdded={onEntrySaved} raceId={selectedRace.id} />
              )}

              {canManage && <p className="cap mt-3">{t('raceFeatures.deadline')}</p>}
              <div className="flex items-center gap-2 mt-5 mb-2">
                <h3 className="text-[14px] font-semibold">{t('races.entries')}</h3>
                <span className="cap num">{selectedRace.entries.length}</span>
              </div>
              {selectedRace.entries.length === 0 ? (
                <p className="cap">{t('races.noEntries')}</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedRace.entries.map((entry) => (
                    <EntryResult
                      key={entry.id}
                      entry={entry}
                      canManage={canManage}
                      canViewHorse={user?.role !== 'OWNER' || entry.horse.ownerId === user?.id}
                      onSaved={onEntrySaved}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-[15px] font-semibold">{t('races.selectRace')}</h2>
              <p className="text-muted mt-1">{t('races.selectRaceDescription')}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function RaceForm({ race, onCancel, onSaved }: { race: Race | null; onCancel: () => void; onSaved: (race: Race) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState(race?.name ?? '');
  const [date, setDate] = useState(toDateInput(race?.date));
  const [venue, setVenue] = useState(race?.venue ?? '');
  const [distance, setDistance] = useState(race?.distance?.toString() ?? '');
  const [surface, setSurface] = useState(race?.surface ?? '');
  const [prizePool, setPrizePool] = useState(race?.prizePool?.toString() ?? '');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const body = {
      name: name.trim(),
      date: new Date(`${date}T00:00:00+07:00`).toISOString(),
      venue: venue.trim() || null,
      distance: distance ? Number(distance) : null,
      surface: surface.trim() || null,
      prizePool: prizePool ? Number(prizePool) : null,
    };
    try {
      const response = race
        ? await api.patch<Race>(`/races/${race.id}`, body)
        : await api.post<Race>('/races', body);
      await onSaved(response.data);
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-3">
          <div><p className="lbl">{t('races.management')}</p><h2 className="text-[15px] font-semibold mt-1">{race ? t('races.editRace') : t('races.createRace')}</h2></div>
          <Btn sm onClick={onCancel}>{t('common.cancel')}</Btn>
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
          <Field label={t('races.name')}><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required /></Field>
          <Field label={t('races.date')}><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
          <Field label={t('races.venue')}><Input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={160} /></Field>
          <Field label={t('races.distanceMeters')}><Input type="number" min="1" step="1" value={distance} onChange={(event) => setDistance(event.target.value)} /></Field>
          <Field label={t('races.surface')}><Input value={surface} onChange={(event) => setSurface(event.target.value)} maxLength={40} /></Field>
          <Field label={t('races.prizePool')}><Input type="number" min="0" step="0.01" value={prizePool} onChange={(event) => setPrizePool(event.target.value)} /></Field>
        </div>
        <ErrorText err={error} />
        <div className="flex gap-2 justify-end">
          <Btn onClick={onCancel}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={saving}>{saving ? t('races.saving') : race ? t('common.save') : t('races.createRace')}</Btn>
        </div>
      </Card>
    </form>
  );
}

function AddEntryForm({ horses, enteredHorseIds, onAdded, raceId }: { horses: Horse[]; enteredHorseIds: string[]; onAdded: () => Promise<void>; raceId: string }) {
  const { t } = useTranslation();
  const enteredHorseIdSet = new Set(enteredHorseIds);
  const eligibleHorses = horses.filter((horse) => (
    horse.status !== 'RETIRED' && horse.healthStatus !== 'QUARANTINED' && horse.healthStatus !== 'INJURED' && !horse.locked && !enteredHorseIdSet.has(horse.id)
  ));
  const [horseId, setHorseId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post<RaceEntry>(`/races/${raceId}/entries`, { horseId });
      setHorseId('');
      await onAdded();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 pt-5 border-t border-line-soft">
      <h3 className="text-[13.5px] font-semibold mb-2">{t('races.registerHorse')}</h3>
      <div className="flex gap-2">
        <NativeSelect className="flex-1" value={horseId} onChange={(event) => setHorseId(event.target.value)} required>
          <option value="">{t('races.chooseHorse')}</option>
          {eligibleHorses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
        </NativeSelect>
        <Btn v="p" type="submit" disabled={saving || !horseId}>{saving ? t('races.saving') : t('races.register')}</Btn>
      </div>
      {eligibleHorses.length === 0 && <p className="cap mt-2">{t('races.noEligibleHorses')}</p>}
      <ErrorText err={error} />
    </form>
  );
}

function EntryResult({ entry, canManage, canViewHorse, onSaved }: {
  entry: RaceDetail['entries'][number]; canManage: boolean; canViewHorse: boolean; onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RaceEntryStatus>(entry.status);
  const [prizeWon, setPrizeWon] = useState(entry.prizeWon?.toString() ?? '');
  const [position, setPosition] = useState(entry.position?.toString() ?? '');
  const [time, setTime] = useState(entry.time ?? '');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/race-entries/${entry.id}`, { status, position: status === 'COMPLETED' && position ? Number(position) : null, time: status === 'COMPLETED' ? time.trim() || null : null, prizeWon: status === 'COMPLETED' && prizeWon ? Number(prizeWon) : null });
      await onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-btn border border-line p-3">
      <div className="flex items-center gap-3">
        <span className={`num w-10 flex-none text-center text-[18px] font-semibold ${entry.position ? 'text-ink' : 'text-muted'}`}>{entry.position ? `#${entry.position}` : '—'}</span>
        <div className="min-w-0 flex-1">
          {canViewHorse ? (
            <Link to={`/horses/${entry.horse.id}/performance`} className="font-semibold text-navy no-underline">{entry.horse.name}</Link>
          ) : (
            <span className="font-semibold">{entry.horse.name}</span>
          )}
          <div className="cap">{t(`raceFeatures.status.${entry.status}`)}{entry.time ? ` \u00b7 ${entry.time}` : ''}</div>
        </div>
      </div>
      {canManage && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2 mt-2.5">
          <Field label={t('races.statusLabel')}><NativeSelect value={status} onChange={(e) => setStatus(e.target.value as RaceEntryStatus)}>{(['PENDING', 'COMPLETED', 'WITHDRAWN', 'DID_NOT_START'] as const).map((value) => <option key={value} value={value}>{t(`raceFeatures.status.${value}`)}</option>)}</NativeSelect></Field>
          <Field label={t('raceFeatures.prize')}><Input type="number" min="0" step="0.01" disabled={status !== 'COMPLETED'} value={prizeWon} onChange={(e) => setPrizeWon(e.target.value)} /></Field>
          <Field label={t('races.position')} className="w-20"><Input type="number" min="1" step="1" disabled={status !== 'COMPLETED'} value={position} onChange={(event) => setPosition(event.target.value)} /></Field>
          <Field label={t('races.time')} className="w-28"><Input disabled={status !== 'COMPLETED'} value={time} onChange={(event) => setTime(event.target.value)} maxLength={40} placeholder="mm:ss" /></Field>
          <Btn sm type="submit" disabled={saving}>{saving ? '…' : t('common.save')}</Btn>
          <ErrorText err={error} />
        </form>
      )}
    </article>
  );
}
