import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { InjuryLocationsSection } from '../components/health/InjuryLocationsSection';
import { api, getFileUrl } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { useCachedResource } from '../lib/useCachedResource';
import type {
  Horse,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Paginated,
} from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Chip, ChipCount, EmptyState, Field, Icon, NativeSelect, PageHeader, Textarea, type Tone } from '../ds/ui';

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

  usePageChrome({ crumbs: [t('incidents.title')] });

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
      <PageHeader
        title={t('incidents.title')}
        sub={loading && !data
          ? t('incidents.loading')
          : highSeverityCount > 0
            ? `${highSeverityCount} sự cố mức nặng chưa xử lý xong · ${counts.OPEN} đang chờ, ${counts.IN_PROGRESS} đang xử lý.`
            : `Không có sự cố mức nặng nào đang mở · ${counts.RESOLVED} trong ${counts.ALL} sự cố đã xử lý.`}
        search={{ placeholder: t('incidents.search'), value: search, onChange: setSearch }}
      />

      {isGroom && <CreateIncidentForm horses={incidentData.horses} onCreated={reload} />}

      <div className="flex flex-wrap gap-2 items-center" role="group" aria-label={t('incidents.filter')}>
        {FILTERS.map((status) => (
          <Chip key={status} on={filter === status} onClick={() => setFilter(status)}>{t(`incidents.filters.${status}`)} <ChipCount n={counts[status]} /></Chip>
        ))}
      </div>

      <ErrorText err={error} />
      {incidentData.errors.map((loadError, index) => <ErrorText key={index} err={loadError} />)}

      {loading && !data ? (
        <p className="text-muted">{t('incidents.loading')}</p>
      ) : filteredIncidents.length === 0 ? (
        <EmptyState>{incidentData.incidents.length === 0 ? t('incidents.emptyDescription') : t('incidents.noMatch')}</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-10 px-5 font-medium border-b border-line">{t('incidents.reportedDate')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('incidents.horse')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('incidents.descriptionLabel')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('incidents.severity')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('incidents.statusLabel')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">Ảnh</th>
                  <th className="h-10 px-4 font-medium border-b border-line">Chấn thương</th>
                  <th className="h-10 px-5 font-medium border-b border-line" aria-label={t('incidents.actions')} />
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} canAdvance={isVet} isVet={isVet} onChanged={reload} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {loading && data && <p className="text-[13px] text-muted">{t('incidents.refreshing')}</p>}
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
      if (fileRef.current) fileRef.current.value = '';
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
            <NativeSelect value={horseId} onChange={(event) => setHorseId(event.target.value)} required>
              <option value="">{t('incidents.chooseHorse')}</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('incidents.severity')} hint={severity === 'HIGH' ? 'Mức nặng sẽ tự khóa tập ngựa cho đến khi sự cố được xử lý xong.' : undefined} err={severity === 'HIGH'}>
            <NativeSelect value={severity} onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}>
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => <option key={level} value={level}>{t(`incidents.severities.${level}`)}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <Field label={t('incidents.descriptionLabel')}>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} required placeholder={t('incidents.descriptionPlaceholder')} />
        </Field>
        <Field label={t('incidents.photo')} hint={t('incidents.photoHint')}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-[12.5px]" />
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

function IncidentRow({ incident, canAdvance, isVet, onChanged }: { incident: Incident; canAdvance: boolean; isVet: boolean; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [injuriesOpen, setInjuriesOpen] = useState(false);
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
        <td className="px-5 py-3 whitespace-nowrap num">
          <div>{formatDate(incident.createdAt)}</div>
          <div className="text-[12.5px] text-muted">{formatTime(incident.createdAt)}</div>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium whitespace-nowrap">{incident.horse.name}</span>
          <div className="text-[12.5px] text-muted whitespace-nowrap">{t('incidents.reportedBy', { name: incident.reportedBy.name })}</div>
        </td>
        <td className="px-4 py-3 min-w-[220px] max-w-[320px]">{incident.description}</td>
        <td className="px-4 py-3"><Badge tone={SEVERITY_TONE[incident.severity]}>{t(`incidents.severities.${incident.severity}`)}</Badge></td>
        <td className="px-4 py-3"><Badge tone={STATUS_TONE[incident.status]}>{t(`incidents.status.${incident.status}`)}</Badge></td>
        <td className="px-4 py-3">
          {photoUrl ? <a href={photoUrl} target="_blank" rel="noreferrer" className="font-semibold text-info">{t('incidents.openPhoto')}</a> : <span className="text-muted">Không</span>}
        </td>
        <td className="px-4 py-3">
          <Btn sm v="g" onClick={() => setInjuriesOpen((v) => !v)}><Icon name={injuriesOpen ? 'chevDown' : 'chevRight'} className="w-3.5 h-3.5" />Chi tiết</Btn>
        </td>
        <td className="pl-4 pr-5 py-3 text-right">
          {canAdvance && next ? (
            <Btn sm disabled={busy} onClick={() => void advance()}>
              {busy ? t('incidents.updating') : t('incidents.moveTo', { status: t(`incidents.status.${next}`) })}
            </Btn>
          ) : <span className="num text-[12.5px] text-muted whitespace-nowrap">Cập nhật {formatDate(incident.updatedAt)}</span>}
        </td>
      </tr>
      {injuriesOpen && (
        <tr className="border-b border-line-soft bg-subtle">
          <td colSpan={8} className="px-4 py-3">
            <InjuryLocationsSection basePath={`/incidents/${incident.id}`} isVet={isVet} />
          </td>
        </tr>
      )}
      {error && <tr><td colSpan={8} className="px-4 pb-3"><ErrorText err={error} /></td></tr>}
    </>
  );
}
