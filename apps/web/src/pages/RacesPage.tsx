import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { api } from '../lib/api';
import { formatDate, toDateInput } from '../lib/format';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Race, RaceDetail, RaceEntry } from '../lib/types';

type RaceFilter = 'ALL' | 'UPCOMING' | 'PAST';
const EMPTY_RACES: Race[] = [];
const EMPTY_HORSES: Horse[] = [];

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

  const {
    data: raceData,
    loading,
    error,
    reload: loadRaces,
  } = useCachedResource(`race-management-${user?.id ?? 'anonymous'}-${canManage}`, async () => {
    const [raceResponse, horseResponse] = await Promise.all([
      api.get<Paginated<Race>>('/races', { params: { limit: 100 } }),
      canManage
        ? api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
        : Promise.resolve(null),
    ]);
    return {
      races: raceResponse.data.data,
      horses: horseResponse?.data.data ?? [],
    };
  });
  const races = raceData?.races ?? EMPTY_RACES;
  const horses = raceData?.horses ?? EMPTY_HORSES;

  const today = toDateInput(new Date().toISOString());
  const upcomingCount = races.filter((race) => toDateInput(race.date) >= today).length;
  const pastCount = races.length - upcomingCount;
  const racesWithVenue = races.filter((race) => race.venue).length;
  const visibleRaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return races
      .filter((race) => {
        const isUpcoming = toDateInput(race.date) >= today;
        if (filter === 'UPCOMING' && !isUpcoming) return false;
        if (filter === 'PAST' && isUpcoming) return false;
        return !query || `${race.name} ${race.venue ?? ''}`.toLocaleLowerCase().includes(query);
      })
      .sort((a, b) => (
        filter === 'PAST'
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime()
      ));
  }, [filter, races, search, today]);

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
    <div className="stack races-page">
      <header className="races-header">
        <div>
          <h1>{t('races.title')}</h1>
          <p className="races-description">{t('races.description')}</p>
        </div>
        <div className="races-header-actions">
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingRace(null);
                setFormOpen((open) => !open);
              }}
            >
              {formOpen && !editingRace ? t('races.closeForm') : `+ ${t('races.createRace')}`}
            </button>
          )}
        </div>
      </header>

      <section className="kpi-grid" aria-label={t('races.summary')}>
        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : races.length}</div>
          <div className="k-label">{t('races.total')}</div>
        </div>
        <div className="kpi-tile ok">
          <div className="k-num">{loading ? '…' : upcomingCount}</div>
          <div className="k-label">{t('races.upcoming')}</div>
        </div>
        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : pastCount}</div>
          <div className="k-label">{t('races.completed')}</div>
        </div>
        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : racesWithVenue}</div>
          <div className="k-label">{t('races.withVenue')}</div>
        </div>
      </section>

      {formOpen && canManage && (
        <RaceForm
          key={editingRace?.id ?? 'new-race'}
          race={editingRace}
          onCancel={() => {
            setFormOpen(false);
            setEditingRace(null);
          }}
          onSaved={onRaceSaved}
        />
      )}

      <ErrorText err={error} />

      <section className="races-workspace">
        <div className="card races-list-panel">
          <div className="races-list-heading">
            <div>
              <h2>{t('races.schedule')}</h2>
              <p>{t('races.scheduleDescription')}</p>
            </div>
            <input
              className="search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('races.search')}
              aria-label={t('races.search')}
            />
          </div>

          <div className="chip-row races-filters" role="group" aria-label={t('races.filter')}>
            {(['UPCOMING', 'ALL', 'PAST'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${filter === value ? 'active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {t(`races.filters.${value}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="muted">{t('races.loading')}</p>
          ) : visibleRaces.length === 0 ? (
            <div className="empty-state">
              <strong>{t('races.emptyTitle')}</strong>
              <span>{races.length === 0 ? t('races.emptyDescription') : t('races.noMatch')}</span>
            </div>
          ) : (
            <div className="races-table-wrap">
              <table className="table races-table">
                <thead>
                  <tr>
                    <th>{t('races.race')}</th>
                    <th>{t('races.date')}</th>
                    <th>{t('races.venue')}</th>
                    <th>{t('races.distance')}</th>
                    <th>{t('races.statusLabel')}</th>
                    <th aria-label={t('races.details')} />
                  </tr>
                </thead>
                <tbody>
                  {visibleRaces.map((race) => (
                    <tr key={race.id} className={selectedRace?.id === race.id ? 'is-selected' : ''}>
                      <td>
                        <button className="races-link-button" type="button" onClick={() => void openRace(race)}>
                          {race.name}
                        </button>
                        <span className="races-subline">
                          {race.surface || t('races.surfaceNotSet')}
                        </span>
                      </td>
                      <td className="races-data">{formatDate(race.date)}</td>
                      <td>{race.venue || '—'}</td>
                      <td className="races-data">{race.distance ? `${race.distance} ${t('races.meters')}` : '—'}</td>
                      <td>
                        <span className={`badge ${toDateInput(race.date) >= today ? 'badge-success' : 'badge-neutral'}`}>
                          {toDateInput(race.date) >= today ? t('races.filters.UPCOMING') : t('races.filters.PAST')}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => void openRace(race)}>
                          {t('races.viewDetails')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="card races-detail-panel" aria-live="polite">
          {detailLoading ? (
            <p className="muted">{t('races.loadingDetails')}</p>
          ) : detailError ? (
            <ErrorText err={detailError} />
          ) : selectedRace ? (
            <>
              <div className="races-detail-heading">
                <div>
                  <p className="races-eyebrow">{t('races.raceDetails')}</p>
                  <h2>{selectedRace.name}</h2>
                </div>
                {canManage && (
                  <button className="btn btn-sm" type="button" onClick={editRace}>
                    {t('races.editRace')}
                  </button>
                )}
              </div>
              <dl className="races-facts">
                <div><dt>{t('races.date')}</dt><dd>{formatDate(selectedRace.date)}</dd></div>
                <div><dt>{t('races.venue')}</dt><dd>{selectedRace.venue || '—'}</dd></div>
                <div><dt>{t('races.distance')}</dt><dd>{selectedRace.distance ? `${selectedRace.distance} ${t('races.meters')}` : '—'}</dd></div>
                <div><dt>{t('races.surface')}</dt><dd>{selectedRace.surface || '—'}</dd></div>
                <div><dt>{t('races.prizePool')}</dt><dd>{selectedRace.prizePool == null ? '—' : selectedRace.prizePool.toLocaleString()} </dd></div>
              </dl>

              {canManage && (
                <AddEntryForm
                  horses={horses}
                  enteredHorseIds={selectedRace.entries.map((entry) => entry.horseId)}
                  onAdded={onEntrySaved}
                  raceId={selectedRace.id}
                />
              )}

              <div className="races-entries-heading">
                <h3>{t('races.entries')}</h3>
                <span className="races-count">{selectedRace.entries.length}</span>
              </div>
              {selectedRace.entries.length === 0 ? (
                <p className="races-empty-inline">{t('races.noEntries')}</p>
              ) : (
                <div className="races-entry-list">
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
            <div className="races-detail-placeholder">
              <p className="races-eyebrow">{t('races.raceDetails')}</p>
              <h2>{t('races.selectRace')}</h2>
              <p>{t('races.selectRaceDescription')}</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function RaceForm({
  race,
  onCancel,
  onSaved,
}: {
  race: Race | null;
  onCancel: () => void;
  onSaved: (race: Race) => Promise<void>;
}) {
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
    <form className="races-form-panel" onSubmit={submit}>
      <div className="races-form-heading">
        <div>
          <p className="races-eyebrow">{t('races.management')}</p>
          <h2>{race ? t('races.editRace') : t('races.createRace')}</h2>
        </div>
        <button className="races-button races-button-ghost" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
      <div className="races-form-grid">
        <Field label={t('races.name')}>
          <input className="races-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
        </Field>
        <Field label={t('races.date')}>
          <input className="races-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label={t('races.venue')}>
          <input className="races-input" value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={160} />
        </Field>
        <Field label={t('races.distanceMeters')}>
          <input className="races-input" type="number" min="1" step="1" value={distance} onChange={(event) => setDistance(event.target.value)} />
        </Field>
        <Field label={t('races.surface')}>
          <input className="races-input" value={surface} onChange={(event) => setSurface(event.target.value)} maxLength={40} />
        </Field>
        <Field label={t('races.prizePool')}>
          <input className="races-input" type="number" min="0" step="0.01" value={prizePool} onChange={(event) => setPrizePool(event.target.value)} />
        </Field>
      </div>
      <ErrorText err={error} />
      <div className="races-form-actions">
        <button className="races-button races-button-ghost" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="races-button races-button-primary" type="submit" disabled={saving}>
          {saving ? t('races.saving') : race ? t('common.save') : t('races.createRace')}
        </button>
      </div>
    </form>
  );
}

function AddEntryForm({
  horses,
  enteredHorseIds,
  onAdded,
  raceId,
}: {
  horses: Horse[];
  enteredHorseIds: string[];
  onAdded: () => Promise<void>;
  raceId: string;
}) {
  const { t } = useTranslation();
  const enteredHorseIdSet = new Set(enteredHorseIds);
  const eligibleHorses = horses.filter((horse) => (
    horse.status !== 'RETIRED' &&
    horse.healthStatus !== 'QUARANTINED' &&
    !horse.locked &&
    !enteredHorseIdSet.has(horse.id)
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
    <form className="races-add-entry" onSubmit={submit}>
      <h3>{t('races.registerHorse')}</h3>
      <div className="races-add-entry-row">
        <select className="races-input" value={horseId} onChange={(event) => setHorseId(event.target.value)} required>
          <option value="">{t('races.chooseHorse')}</option>
          {eligibleHorses.map((horse) => (
            <option key={horse.id} value={horse.id}>{horse.name}</option>
          ))}
        </select>
        <button className="races-button races-button-primary" type="submit" disabled={saving || !horseId}>
          {saving ? t('races.saving') : t('races.register')}
        </button>
      </div>
      {eligibleHorses.length === 0 && <p className="races-empty-inline">{t('races.noEligibleHorses')}</p>}
      <ErrorText err={error} />
    </form>
  );
}

function EntryResult({
  entry,
  canManage,
  canViewHorse,
  onSaved,
}: {
  entry: RaceDetail['entries'][number];
  canManage: boolean;
  canViewHorse: boolean;
  onSaved: () => Promise<void>;
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
      await api.patch(`/race-entries/${entry.id}`, {
        position: position ? Number(position) : null,
        time: time.trim() || null,
      });
      await onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="races-entry">
      <div className="races-entry-horse">
        <span className="races-place">{entry.position ? `#${entry.position}` : '—'}</span>
        <div>
          {canViewHorse ? (
            <Link to={`/horses/${entry.horse.id}/performance`} className="races-horse-link">{entry.horse.name}</Link>
          ) : (
            <span className="races-link-button">{entry.horse.name}</span>
          )}
          <span className="races-subline">{entry.time || t('races.resultPending')}</span>
        </div>
      </div>
      {canManage && (
        <form className="races-result-form" onSubmit={save}>
          <label>
            <span>{t('races.position')}</span>
            <input className="races-input" type="number" min="1" step="1" value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
          <label>
            <span>{t('races.time')}</span>
            <input className="races-input" value={time} onChange={(event) => setTime(event.target.value)} maxLength={40} placeholder="mm:ss" />
          </label>
          <button className="races-button races-button-small" type="submit" disabled={saving}>
            {saving ? '…' : t('common.save')}
          </button>
          <ErrorText err={error} />
        </form>
      )}
    </article>
  );
}
