import i18n from '../i18n';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
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
import { usePageChrome } from '../ds/AppShell';
import { FileInput, Badge, Btn, Card, Field, HeroStats, Icon, Textarea, type Tone } from '../ds/ui';

type IncidentFilter = 'ALL' | IncidentStatus;
type IncidentData = { horses: Horse[]; incidents: Incident[]; errors: unknown[] };

const EMPTY_INCIDENT_DATA: IncidentData = { horses: [], incidents: [], errors: [] };
const FILTERS: IncidentFilter[] = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];
const INCIDENTS_PAGE_SIZE = 100;

const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: null,
};

const SEVERITY_TONE: Record<IncidentSeverity, Tone> = { LOW: 'neu', MEDIUM: 'warn', HIGH: 'bad' };
const STATUS_TONE: Record<IncidentStatus, Tone> = { OPEN: 'bad', IN_PROGRESS: 'warn', RESOLVED: 'ok' };

async function loadIncidentsForHorse(horseId: string): Promise<Incident[]> {
  const incidents: Incident[] = [];
  let page = 1;
  while (true) {
    const response = await api.get<Paginated<Incident>>(
      `/horses/${horseId}/incidents`,
      { params: { page, limit: INCIDENTS_PAGE_SIZE } },
    );
    incidents.push(...response.data.data);
    if (page * response.data.meta.limit >= response.data.meta.total) break;
    page += 1;
  }
  return incidents;
}

async function loadIncidentData(): Promise<IncidentData> {
  const horseResponse = await api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } });
  const horses = horseResponse.data.data;
  const results = await Promise.all(
    horses.map(async (horse) => {
      try {
        return { incidents: await loadIncidentsForHorse(horse.id), error: null };
      } catch (error) {
        return { incidents: [], error };
      }
    }),
  );
  const incidents = results.flatMap((result) => result.incidents);
  incidents.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return {
    horses,
    incidents,
    errors: results.flatMap((result) => result.error ? [result.error] : []),
  };
}

export function IncidentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGroom = user?.role === 'GROOM';
  const isVet = user?.role === 'VET';
  const [filter, setFilter] = useState<IncidentFilter>('ALL');
  const [search, setSearch] = useState('');

  usePageChrome({ crumbs: [i18n.t("ui.health"), t('incidents.title')], search: t('incidents.search'), onSearch: setSearch });

  const { data, loading, error, reload } = useCachedResource(
    `health-incidents-${user?.id ?? 'anonymous'}`,
    loadIncidentData,
  );
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

  const { counts, highSeverityCount } = useMemo(() => {
    const summary = {
      counts: { ALL: incidentData.incidents.length, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 } satisfies Record<IncidentFilter, number>,
      highSeverityCount: 0,
    };
    for (const incident of incidentData.incidents) {
      summary.counts[incident.status] += 1;
      if (incident.severity === 'HIGH' && incident.status !== 'RESOLVED') summary.highSeverityCount += 1;
    }
    return summary;
  }, [incidentData.incidents]);

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div>
          <div className="lbl">{i18n.t("ui.health")}</div>
          <h1 className="disp text-[56px] mt-2">{t('incidents.title')}</h1>
          <p className="text-hero-muted mt-2 max-w-[560px]">{isGroom ? t('incidents.groomDescription') : t('incidents.description')}</p>
        </div>
        <HeroStats items={[
          { label: t('incidents.total'), value: loading && !data ? '…' : counts.ALL },
          { label: t('incidents.highPriority'), value: loading && !data ? '…' : highSeverityCount, color: '#f3b4b4' },
          { label: t('incidents.inProgress'), value: loading && !data ? '…' : counts.IN_PROGRESS, color: '#f3d29a' },
          { label: t('incidents.resolved'), value: loading && !data ? '…' : counts.RESOLVED, color: '#9fd9b1' },
        ]} />
      </section>

      {isGroom && <CreateIncidentForm horses={incidentData.horses} onCreated={reload} />}

      <div className="flex flex-wrap gap-2.5 items-center" role="group" aria-label={t('incidents.filter')}>
        {FILTERS.map((status) => (
          <button key={status} type="button" onClick={() => setFilter(status)}
            className={`inline-flex items-center h-[30px] px-3 rounded-full border text-[12.5px] font-medium ${filter === status ? 'bg-navy text-white border-navy' : 'bg-white text-ink border-line'}`}>
            {t(`incidents.filters.${status}`)} ({counts[status]})
          </button>
        ))}
      </div>

      <ErrorText err={error} />
      {incidentData.errors.map((loadError, index) => <ErrorText key={index} err={loadError} />)}

      {loading && !data ? (
        <p className="cap">{t('incidents.loading')}</p>
      ) : filteredIncidents.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="cap">{incidentData.incidents.length === 0 ? t('incidents.emptyDescription') : t('incidents.noMatch')}</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('incidents.reportedDate'), t('incidents.horse'), t('incidents.descriptionLabel'), t('incidents.severity'), t('incidents.statusLabel'), t('incidents.photo'), t('incidents.actions')].map((th) => (
                    <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} canAdvance={isVet} onChanged={reload} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {loading && data && <p className="cap">{t('incidents.refreshing')}</p>}
    </>
  );
}

function CreateIncidentForm({ horses, onCreated }: { horses: Horse[]; onCreated: () => Promise<void> }) {
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
      if (fileRef.current) {
        fileRef.current.value = '';
        fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await onCreated();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">{t('incidents.reportTitle')}</h2>
          <p className="cap mt-1">{t('incidents.reportHint')}</p>
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
          <Field label={t('incidents.horse')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={horseId} onChange={(event) => setHorseId(event.target.value)} required
            >
              <option value="">{t('incidents.chooseHorse')}</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </select>
          </Field>
          <Field label={t('incidents.severity')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={severity} onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
            >
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => <option key={level} value={level}>{t(`incidents.severities.${level}`)}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('incidents.descriptionLabel')}>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} required placeholder={t('incidents.descriptionPlaceholder')} />
        </Field>
        <Field label={t('incidents.photo')} hint={t('incidents.photoHint')}>
          <FileInput ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-[12.5px]" />
        </Field>
        <ErrorText err={error} />
        {photoError && (
          <div role="alert" className="flex flex-col gap-1">
            <span className="text-[12.5px] text-bad font-semibold">{t('incidents.reportSavedPhotoFailed')}</span>
            <ErrorText err={photoError} />
          </div>
        )}
        <Btn v="p" type="submit" disabled={saving || !horseId || horses.length === 0} className="self-start">
          <Icon name="send" />{saving ? t('incidents.sending') : t('incidents.submitReport')}
        </Btn>
      </Card>
    </form>
  );
}

function IncidentRow({ incident, canAdvance, onChanged }: { incident: Incident; canAdvance: boolean; onChanged: () => Promise<void> }) {
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
      <tr className="border-b border-line-soft hover:bg-subtle align-top">
        <td className="px-4 py-3">
          <div className="text-[13px]">{formatDate(incident.createdAt)}</div>
          <div className="cap">{formatDateTime(incident.createdAt)}</div>
        </td>
        <td className="px-4 py-3">
          <strong>{incident.horse.name}</strong>
          <div className="cap">{t('incidents.reportedBy', { name: incident.reportedBy.name })}</div>
        </td>
        <td className="px-4 py-3 max-w-[280px]">{incident.description}</td>
        <td className="px-4 py-3"><Badge tone={SEVERITY_TONE[incident.severity]}>{t(`incidents.severities.${incident.severity}`)}</Badge></td>
        <td className="px-4 py-3"><Badge tone={STATUS_TONE[incident.status]}>{t(`incidents.status.${incident.status}`)}</Badge></td>
        <td className="px-4 py-3">
          {photoUrl ? <a href={photoUrl} target="_blank" rel="noreferrer" className="font-semibold text-info">{t('incidents.openPhoto')}</a> : <span className="cap">—</span>}
        </td>
        <td className="px-4 py-3">
          {canAdvance && next ? (
            <Btn sm disabled={busy} onClick={() => void advance()}>
              {busy ? t('incidents.updating') : t('incidents.moveTo', { status: t(`incidents.status.${next}`) })}
            </Btn>
          ) : <span className="cap">{formatDate(incident.updatedAt)}</span>}
        </td>
      </tr>
      {error && <tr><td colSpan={7} className="px-4 pb-3"><ErrorText err={error} /></td></tr>}
    </>
  );
}
