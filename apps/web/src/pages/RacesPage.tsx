import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { api } from '../lib/api';
import { formatDate, toDateInput } from '../lib/format';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Race, RaceDetail, RaceEntry } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Chip, Field, HeroStats, Icon, Input } from '../ds/ui';

type RaceFilter = 'ALL' | 'UPCOMING' | 'PAST';
const EMPTY_RACES: Race[] = [];
const EMPTY_HORSES: Horse[] = [];

function isUpcomingRace(race: Pick<Race, 'date'>, today: string): boolean {
  return toDateInput(race.date) >= today;
}

function summarizeRaces(races: Race[], today: string) {
  return races.reduce(
    (summary, race) => {
      if (isUpcomingRace(race, today)) summary.upcoming += 1;
      else summary.past += 1;
      if (race.venue) summary.withVenue += 1;
      return summary;
    },
    { upcoming: 0, past: 0, withVenue: 0 },
  );
}

function getVisibleRaces(races: Race[], filter: RaceFilter, search: string, today: string): Race[] {
  const query = search.trim().toLocaleLowerCase();
  return races
    .filter((race) => {
      const isUpcoming = isUpcomingRace(race, today);
      if (filter === 'UPCOMING' && !isUpcoming) return false;
      if (filter === 'PAST' && isUpcoming) return false;
      return !query || `${race.name} ${race.venue ?? ''}`.toLocaleLowerCase().includes(query);
    })
    .sort((left, right) => (
      filter === 'PAST'
        ? new Date(right.date).getTime() - new Date(left.date).getTime()
        : new Date(left.date).getTime() - new Date(right.date).getTime()
    ));
}

export function RacesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === 'MANAGER';
  const [selectedRace, setSelectedRace] = useState<RaceDetail | null>(null);
  const [filter, setFilter] = useState<RaceFilter>('UPCOMING');
  const [search, setSearch] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  usePageChrome({ crumbs: [t('nav.races'), t('races.title')], search: t('races.search'), onSearch: setSearch });

  const { data: raceData, loading, error, reload: loadRaces } = useCachedResource(
    `race-management-${user?.id ?? 'anonymous'}-${canManage}`,
    async () => {
      const [raceResponse, horseResponse] = await Promise.all([
        api.get<Paginated<Race>>('/races', { params: { limit: 100 } }),
        canManage ? api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } }) : Promise.resolve(null),
      ]);
      return { races: raceResponse.data.data, horses: horseResponse?.data.data ?? [] };
    },
  );
  const races = raceData?.races ?? EMPTY_RACES;
  const horses = raceData?.horses ?? EMPTY_HORSES;

  const today = toDateInput(new Date().toISOString());
  const summary = useMemo(() => summarizeRaces(races, today), [races, today]);
  const visibleRaces = useMemo(() => getVisibleRaces(races, filter, search, today), [filter, races, search, today]);

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

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div>
            <div className="lbl">{t('common.season', { year: 2026 })} · {t('nav.brandName')}</div>
            <h1 className="disp text-[56px] mt-2">{t('races.title')}</h1>
            <p className="text-hero-muted mt-2 max-w-[560px]">{t('races.description')}</p>
          </div>
          {canManage && (
            <Btn v="light" onClick={() => { setEditingRace(null); setFormOpen((open) => !open); }}>
              <Icon name={formOpen && !editingRace ? 'x' : 'plus'} />{formOpen && !editingRace ? t('races.closeForm') : t('races.createRace')}
            </Btn>
          )}
        </div>
        <HeroStats items={[
          { label: t('races.total'), value: loading ? '…' : races.length },
          { label: t('races.upcoming'), value: loading ? '…' : summary.upcoming, color: '#9fd9b1' },
          { label: t('races.completed'), value: loading ? '…' : summary.past },
          { label: t('races.withVenue'), value: loading ? '…' : summary.withVenue },
        ]} />
      </section>

      {formOpen && canManage && (
        <RaceForm key={editingRace?.id ?? 'new-race'} race={editingRace} onCancel={() => { setFormOpen(false); setEditingRace(null); }} onSaved={onRaceSaved} />
      )}

      <ErrorText err={error} />

      <div className="flex flex-wrap gap-5 items-start">
        <Card className="flex-[1.3_1_460px] min-w-0 p-5">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">{t('races.schedule')}</h2>
              <p className="cap mt-1">{t('races.scheduleDescription')}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4" role="group" aria-label={t('races.filter')}>
            {(['UPCOMING', 'ALL', 'PAST'] as const).map((value) => (
              <Chip key={value} on={filter === value} onClick={() => setFilter(value)}>{t(`races.filters.${value}`)}</Chip>
            ))}
          </div>

          {loading ? (
            <p className="cap mt-4">{t('races.loading')}</p>
          ) : visibleRaces.length === 0 ? (
            <div className="text-center py-10">
              <strong className="block">{t('races.emptyTitle')}</strong>
              <span className="cap">{races.length === 0 ? t('races.emptyDescription') : t('races.noMatch')}</span>
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="text-left">
                    {[t('races.race'), t('races.date'), t('races.venue'), t('races.distance'), t('races.statusLabel'), ''].map((th) => (
                      <th key={th} className="h-[40px] px-3 bg-cream lbl border-b border-line">{th}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRaces.map((race) => {
                    const isUpcoming = isUpcomingRace(race, today);
                    const isSelected = selectedRace?.id === race.id;
                    return (
                      <tr key={race.id} className={`border-b border-line-soft hover:bg-subtle ${isSelected ? 'bg-info-bg' : ''}`}>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => void openRace(race)} className="font-semibold text-navy">{race.name}</button>
                          <div className="cap">{race.surface || t('races.surfaceNotSet')}</div>
                        </td>
                        <td className="px-3 py-2.5 num">{formatDate(race.date)}</td>
                        <td className="px-3 py-2.5">{race.venue || '—'}</td>
                        <td className="px-3 py-2.5 num">{race.distance ? `${race.distance} ${t('races.meters')}` : '—'}</td>
                        <td className="px-3 py-2.5"><Badge tone={isUpcoming ? 'ok' : 'neu'}>{isUpcoming ? t('races.filters.UPCOMING') : t('races.filters.PAST')}</Badge></td>
                        <td className="px-3 py-2.5"><Btn sm onClick={() => void openRace(race)}>{t('races.viewDetails')}</Btn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="flex-[1_1_380px] min-w-0 p-5" aria-live="polite">
          {detailLoading ? (
            <p className="cap">{t('races.loadingDetails')}</p>
          ) : detailError ? (
            <ErrorText err={detailError} />
          ) : selectedRace ? (
            <>
              <div className="flex justify-between items-start gap-3">
                <div><p className="lbl">{t('races.raceDetails')}</p><h2 className="disp text-[32px] mt-1">{selectedRace.name}</h2></div>
                {canManage && <Btn sm onClick={editRace}><Icon name="edit" className="w-3.5 h-3.5" />{t('races.editRace')}</Btn>}
              </div>
              <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 mt-4 text-[13px]">
                <dt className="text-muted">{t('races.date')}</dt><dd className="m-0">{formatDate(selectedRace.date)}</dd>
                <dt className="text-muted">{t('races.venue')}</dt><dd className="m-0">{selectedRace.venue || '—'}</dd>
                <dt className="text-muted">{t('races.distance')}</dt><dd className="m-0">{selectedRace.distance ? `${selectedRace.distance} ${t('races.meters')}` : '—'}</dd>
                <dt className="text-muted">{t('races.surface')}</dt><dd className="m-0">{selectedRace.surface || '—'}</dd>
                <dt className="text-muted">{t('races.prizePool')}</dt><dd className="m-0">{selectedRace.prizePool == null ? '—' : selectedRace.prizePool.toLocaleString()}</dd>
              </dl>

              {canManage && (
                <AddEntryForm horses={horses} enteredHorseIds={selectedRace.entries.map((entry) => entry.horseId)} onAdded={onEntrySaved} raceId={selectedRace.id} />
              )}

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
            <div className="text-center py-10">
              <p className="lbl">{t('races.raceDetails')}</p>
              <h2 className="disp text-[28px] mt-1">{t('races.selectRace')}</h2>
              <p className="cap mt-2">{t('races.selectRaceDescription')}</p>
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
      date: new Date(`${date}T00:00:00.000Z`).toISOString(),
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
    horse.status !== 'RETIRED' && horse.healthStatus !== 'QUARANTINED' && !horse.locked && !enteredHorseIdSet.has(horse.id)
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
        <select
          className="h-10 flex-1 rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
          value={horseId} onChange={(event) => setHorseId(event.target.value)} required
        >
          <option value="">{t('races.chooseHorse')}</option>
          {eligibleHorses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
        </select>
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
  const [position, setPosition] = useState(entry.position?.toString() ?? '');
  const [time, setTime] = useState(entry.time ?? '');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/race-entries/${entry.id}`, { position: position ? Number(position) : null, time: time.trim() || null });
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
        <span className="disp text-2xl w-10 flex-none text-center">{entry.position ? `#${entry.position}` : '—'}</span>
        <div className="min-w-0 flex-1">
          {canViewHorse ? (
            <Link to={`/horses/${entry.horse.id}/performance`} className="font-semibold text-navy no-underline">{entry.horse.name}</Link>
          ) : (
            <span className="font-semibold">{entry.horse.name}</span>
          )}
          <div className="cap">{entry.time || t('races.resultPending')}</div>
        </div>
      </div>
      {canManage && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2 mt-2.5">
          <Field label={t('races.position')} className="w-20"><Input type="number" min="1" step="1" value={position} onChange={(event) => setPosition(event.target.value)} /></Field>
          <Field label={t('races.time')} className="w-28"><Input value={time} onChange={(event) => setTime(event.target.value)} maxLength={40} placeholder="mm:ss" /></Field>
          <Btn sm type="submit" disabled={saving}>{saving ? '…' : t('common.save')}</Btn>
          <ErrorText err={error} />
        </form>
      )}
    </article>
  );
}
