import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { api, getFileUrl } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { useCachedResource } from '../lib/useCachedResource';
import type {
  Horse,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Paginated,
} from '../lib/types';

type IncidentFilter = 'ALL' | IncidentStatus;
type IncidentData = { horses: Horse[]; incidents: Incident[]; errors: unknown[] };

const EMPTY_INCIDENT_DATA: IncidentData = { horses: [], incidents: [], errors: [] };
const FILTERS: IncidentFilter[] = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: null,
};

const SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  LOW: 'badge-neutral',
  MEDIUM: 'badge-warning',
  HIGH: 'badge-danger',
};

const STATUS_BADGE: Record<IncidentStatus, string> = {
  OPEN: 'badge-danger',
  IN_PROGRESS: 'badge-warning',
  RESOLVED: 'badge-success',
};

export function IncidentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGroom = user?.role === 'GROOM';
  const isVet = user?.role === 'VET';
  const [filter, setFilter] = useState<IncidentFilter>('ALL');
  const [search, setSearch] = useState('');

  const {
    data,
    loading,
    error,
    reload,
  } = useCachedResource(`health-incidents-${user?.id ?? 'anonymous'}`, async () => {
    const horseResponse = await api.get<Paginated<Horse>>('/horses', {
      params: { limit: 100 },
    });
    const horses = horseResponse.data.data;
    const results = await Promise.all(
      horses.map(async (horse) => {
        try {
          const response = await api.get<Paginated<Incident>>(
            `/horses/${horse.id}/incidents`,
            { params: { limit: 10 } },
          );
          return { incidents: response.data.data, error: null };
        } catch (reason) {
          return { incidents: [], error: reason };
        }
      }),
    );
    const incidents = results.flatMap((result) => result.incidents);
    incidents.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    return {
      horses,
      incidents,
      errors: results.flatMap((result) => result.error ? [result.error] : []),
    };
  });
  const incidentData = data ?? EMPTY_INCIDENT_DATA;
  const filteredIncidents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return incidentData.incidents.filter((incident) => {
      if (filter !== 'ALL' && incident.status !== filter) return false;
      return !query ||
        `${incident.horse.name} ${incident.description} ${incident.reportedBy.name}`
          .toLocaleLowerCase()
          .includes(query);
    });
  }, [filter, incidentData.incidents, search]);

  const counts: Record<IncidentFilter, number> = {
    ALL: incidentData.incidents.length,
    OPEN: incidentData.incidents.filter((incident) => incident.status === 'OPEN').length,
    IN_PROGRESS: incidentData.incidents.filter((incident) => incident.status === 'IN_PROGRESS').length,
    RESOLVED: incidentData.incidents.filter((incident) => incident.status === 'RESOLVED').length,
  };
  const highSeverityCount = incidentData.incidents.filter(
    (incident) => incident.severity === 'HIGH' && incident.status !== 'RESOLVED',
  ).length;

  return (
    <div className="stack incidents-standard-page">
      <div>
        <h1>{t('incidents.title')}</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          {isGroom ? t('incidents.groomDescription') : t('incidents.description')}
        </p>
      </div>

      {isGroom && <CreateIncidentForm horses={incidentData.horses} onCreated={reload} />}

      <div className="kpi-grid">
        <div className="kpi-tile">
          <div className="k-num">{loading && !data ? '…' : counts.ALL}</div>
          <div className="k-label">{t('incidents.total')}</div>
        </div>
        <div className="kpi-tile alert">
          <div className="k-num">{loading && !data ? '…' : highSeverityCount}</div>
          <div className="k-label">{t('incidents.highPriority')}</div>
        </div>
        <div className="kpi-tile warn">
          <div className="k-num">{loading && !data ? '…' : counts.IN_PROGRESS}</div>
          <div className="k-label">{t('incidents.inProgress')}</div>
        </div>
        <div className="kpi-tile ok">
          <div className="k-num">{loading && !data ? '…' : counts.RESOLVED}</div>
          <div className="k-label">{t('incidents.resolved')}</div>
        </div>
      </div>

      <div className="toolbar incidents-toolbar">
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('incidents.search')}
          aria-label={t('incidents.search')}
        />
        <div className="chip-row" role="group" aria-label={t('incidents.filter')}>
          {FILTERS.map((status) => (
            <button
              key={status}
              className={`chip ${filter === status ? 'active' : ''}`}
              type="button"
              onClick={() => setFilter(status)}
            >
              {t(`incidents.filters.${status}`)} ({counts[status]})
            </button>
          ))}
        </div>
      </div>

      <ErrorText err={error} />
      {incidentData.errors.map((loadError, index) => (
        <ErrorText key={index} err={loadError} />
      ))}

      {loading && !data ? (
        <p className="muted">{t('incidents.loading')}</p>
      ) : filteredIncidents.length === 0 ? (
        <div className="card empty-state incidents-empty">
          <p className="muted" style={{ margin: 0 }}>
            {incidentData.incidents.length === 0
              ? t('incidents.emptyDescription')
              : t('incidents.noMatch')}
          </p>
        </div>
      ) : (
        <div className="table-wrap incidents-table-wrap">
          <table className="table incidents-table">
            <thead>
              <tr>
                <th>{t('incidents.reportedDate')}</th>
                <th>{t('incidents.horse')}</th>
                <th>{t('incidents.descriptionLabel')}</th>
                <th>{t('incidents.severity')}</th>
                <th>{t('incidents.statusLabel')}</th>
                <th>{t('incidents.photo')}</th>
                <th>{t('incidents.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  canAdvance={isVet}
                  onChanged={reload}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && data && (
        <p className="muted small incidents-refreshing">{t('incidents.refreshing')}</p>
      )}
    </div>
  );
}

function CreateIncidentForm({
  horses,
  onCreated,
}: {
  horses: Horse[];
  onCreated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [horseId, setHorseId] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('LOW');
  const [error, setError] = useState<unknown>(null);
  const [photoError, setPhotoError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPhotoError(null);
    setSaving(true);
    try {
      const response = await api.post<Incident>(`/horses/${horseId}/incidents`, {
        description: description.trim(),
        severity,
      });
      const file = fileRef.current?.files?.[0];
      setDescription('');
      setSeverity('LOW');
      setHorseId('');

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await api.post(`/incidents/${response.data.id}/photo`, formData);
        } catch (reason) {
          setPhotoError(reason);
        }
      }
      if (fileRef.current) fileRef.current.value = '';
      await onCreated();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card incidents-report-form" onSubmit={submit}>
      <h2>{t('incidents.reportTitle')}</h2>
      <p className="muted small">{t('incidents.reportHint')}</p>
      <div className="form-grid-2">
        <Field label={t('incidents.horse')}>
          <select
            className="input"
            value={horseId}
            onChange={(event) => setHorseId(event.target.value)}
            required
          >
            <option value="">{t('incidents.chooseHorse')}</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>{horse.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t('incidents.severity')}>
          <select
            className="input"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
          >
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
              <option key={level} value={level}>{t(`incidents.severities.${level}`)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('incidents.descriptionLabel')}>
        <textarea
          className="input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder={t('incidents.descriptionPlaceholder')}
        />
      </Field>
      <Field label={t('incidents.photo')}>
        <input
          ref={fileRef}
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <span className="field-hint">{t('incidents.photoHint')}</span>
      </Field>
      <ErrorText err={error} />
      {photoError && (
        <div className="incidents-photo-error" role="alert">
          <span>{t('incidents.reportSavedPhotoFailed')}</span>
          <ErrorText err={photoError} />
        </div>
      )}
      <button
        className="btn btn-primary"
        type="submit"
        disabled={saving || !horseId || horses.length === 0}
      >
        {saving ? t('incidents.sending') : t('incidents.submitReport')}
      </button>
    </form>
  );
}

function IncidentRow({
  incident,
  canAdvance,
  onChanged,
}: {
  incident: Incident;
  canAdvance: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[incident.status];
  const photoUrl = getFileUrl(incident.photoUrl);

  const advance = async () => {
    if (!next) return;
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/incidents/${incident.id}`, { status: next });
      await onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr>
        <td>
          <div>{formatDate(incident.createdAt)}</div>
          <div className="muted small">{formatDateTime(incident.createdAt)}</div>
        </td>
        <td>
          <strong>{incident.horse.name}</strong>
          <div className="muted small">
            {t('incidents.reportedBy', { name: incident.reportedBy.name })}
          </div>
        </td>
        <td className="incident-description-cell">{incident.description}</td>
        <td>
          <span className={`badge ${SEVERITY_BADGE[incident.severity]}`}>
            {t(`incidents.severities.${incident.severity}`)}
          </span>
        </td>
        <td>
          <span className={`badge ${STATUS_BADGE[incident.status]}`}>
            {t(`incidents.status.${incident.status}`)}
          </span>
        </td>
        <td>
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noreferrer">
              {t('incidents.openPhoto')}
            </a>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td>
          {canAdvance && next ? (
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => void advance()}
              disabled={busy}
            >
              {busy ? t('incidents.updating') : t('incidents.moveTo', { status: t(`incidents.status.${next}`) })}
            </button>
          ) : (
            <span className="muted small">{formatDate(incident.updatedAt)}</span>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7}><ErrorText err={error} /></td>
        </tr>
      )}
    </>
  );
}
