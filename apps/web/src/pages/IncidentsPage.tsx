import i18n from '../i18n';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { Alert, Badge, Btn, Card, Chip, ChipCount, EmptyState, Field, Icon, ImageLightbox, NativeSelect, PageHeader, Textarea, type Tone } from '../ds/ui';

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
                  <th className="h-10 px-4 font-medium border-b border-line">{i18n.t("horseFlow.health.INJURED")}</th>
                  <th className="h-10 px-5 font-medium border-b border-line" aria-label={t('incidents.actions')} />
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} canAdvance={isVet} isVet={isVet} isGroom={isGroom} onChanged={reload} />
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

// UC-19 — mirrors the API's image rule (jpg/png/webp, UPLOAD_MAX_MB = 5) so a
// wrong file is caught before the report is sent, not after.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_MB = 5;
function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.';
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) return `Ảnh nặng ${(file.size / 1024 / 1024).toFixed(1)} MB — tối đa ${PHOTO_MAX_MB} MB.`;
  return null;
}
async function uploadIncidentPhoto(incidentId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  await api.post(`/incidents/${incidentId}/photo`, formData);
}

/** File picker with a preview of the chosen photo and an inline check of type and size. */
function PhotoPicker({ file, onChange, disabled }: { file: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const p = photoProblem(f);
    setProblem(p);
    onChange(p ? null : f);
    if (p && inputRef.current) inputRef.current.value = '';
  };
  const clear = () => { onChange(null); setProblem(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="flex flex-col gap-2">
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-btn border border-line p-2 pr-3 bg-subtle">
          <img src={preview} alt="Ảnh sẽ gửi kèm" className="w-16 h-16 rounded-badge object-cover flex-none" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium truncate">{file.name}</div>
            <div className="num text-[12.5px] text-muted">{(file.size / 1024).toFixed(0)} KB</div>
          </div>
          <Btn sm v="g" onClick={clear} disabled={disabled}><Icon name="x" className="w-3.5 h-3.5" />Bỏ ảnh</Btn>
        </div>
      ) : (
        <input ref={inputRef} type="file" accept={PHOTO_TYPES.join(',')} disabled={disabled}
          onChange={(e) => pick(e.target.files?.[0])} aria-label="Chọn ảnh minh chứng" />
      )}
      {problem && <p className="text-bad font-medium text-[13px]" role="alert">{problem}</p>}
    </div>
  );
}

function CreateIncidentForm({ horses, onCreated }: { horses: Horse[]; onCreated: () => Promise<void> }) {
  const { t } = useTranslation();
  const [horseId, setHorseId] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('LOW');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [photoError, setPhotoError] = useState<unknown>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPhotoError(null);
    setSent(null);
    setSaving(true);
    try {
      const response = await api.post<Incident>(`/horses/${horseId}/incidents`, {
        description: description.trim(),
        severity,
      });
      const horseName = horses.find((h) => h.id === horseId)?.name ?? '';
      if (photo) {
        try {
          await uploadIncidentPhoto(response.data.id, photo);
        } catch (reason) {
          // The report itself is saved; the photo can be added again from its row.
          setPhotoError(reason);
        }
      }
      setDescription('');
      setSeverity('LOW');
      setHorseId('');
      setPhoto(null);
      setSent(horseName);
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
        <Field label={t('incidents.photo')} hint={`JPEG, PNG hoặc WebP, tối đa ${PHOTO_MAX_MB} MB.`}>
          <PhotoPicker file={photo} onChange={setPhoto} disabled={saving} />
        </Field>
        <ErrorText err={error} />
        {sent != null && !photoError && (
          <Alert tone="ok" icon="check">Đã gửi báo cáo sự cố{sent ? ` cho ${sent}` : ''} — bác sĩ thú y đã được thông báo.</Alert>
        )}
        {photoError != null && (
          <Alert tone="warn" icon="alert" title={t('incidents.reportSavedPhotoFailed')}>
            Bấm “Thêm ảnh” ở dòng sự cố vừa gửi trong bảng bên dưới để tải lại.
          </Alert>
        )}
        <Btn v="p" type="submit" disabled={saving || !horseId || horses.length === 0} className="self-start">
          <Icon name="send" />{saving ? t('incidents.sending') : t('incidents.submitReport')}
        </Btn>
      </Card>
    </form>
  );
}

/** The evidence photo: a thumbnail that opens full size, plus add/replace for the groom while the case is open. */
function IncidentPhotoCell({ incident, photoUrl, canUpload, onChanged }: { incident: Incident; photoUrl: string | null; canUpload: boolean; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const p = photoProblem(file);
    if (p) { setProblem(new Error(p)); return; }
    setProblem(null);
    setBusy(true);
    try {
      await uploadIncidentPhoto(incident.id, file);
      await onChanged();
    } catch (reason) {
      setProblem(reason);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      {photoUrl ? (
        <>
          <button type="button" onClick={() => setOpen(true)} aria-label={t('incidents.openPhoto')}
            className="w-12 h-12 rounded-badge overflow-hidden border border-line cursor-zoom-in flex-none">
            <img src={photoUrl} alt={t('incidents.photoAlt', { horse: incident.horse.name })} className="w-full h-full object-cover" loading="lazy" />
          </button>
          <ImageLightbox src={photoUrl} alt={t('incidents.photoAlt', { horse: incident.horse.name })} open={open} onClose={() => setOpen(false)} />
        </>
      ) : !canUpload && <span className="text-muted">{i18n.t("mergeUi.no")}</span>}
      {canUpload && (
        <>
          <input ref={inputRef} type="file" accept={PHOTO_TYPES.join(',')} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          <Btn sm v="g" disabled={busy} onClick={() => inputRef.current?.click()} className="-ml-2">
            <Icon name="camera" className="w-3.5 h-3.5" />{busy ? i18n.t("treatmentPlans.loading") : photoUrl ? i18n.t("ui.changePhoto") : 'Thêm ảnh'}
          </Btn>
        </>
      )}
      {problem != null && (problem instanceof Error && !('response' in problem)
        ? <p className="text-bad text-[12.5px] font-medium max-w-[160px]" role="alert">{problem.message}</p>
        : <ErrorText err={problem} />)}
    </div>
  );
}

function IncidentRow({ incident, canAdvance, isVet, isGroom, onChanged }: { incident: Incident; canAdvance: boolean; isVet: boolean; isGroom: boolean; onChanged: () => Promise<void> }) {
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
          <IncidentPhotoCell incident={incident} photoUrl={photoUrl} canUpload={isGroom && incident.status !== 'RESOLVED'} onChanged={onChanged} />
        </td>
        <td className="px-4 py-3">
          <Btn sm v="g" onClick={() => setInjuriesOpen((v) => !v)}><Icon name={injuriesOpen ? 'chevDown' : 'chevRight'} className="w-3.5 h-3.5" />{i18n.t("races.viewDetails")}</Btn>
        </td>
        <td className="pl-4 pr-5 py-3 text-right">
          {canAdvance && next ? (
            <Btn sm disabled={busy} onClick={() => void advance()}>
              {busy ? t('incidents.updating') : t('incidents.moveTo', { status: t(`incidents.status.${next}`) })}
            </Btn>
          ) : <span className="num text-[12.5px] text-muted whitespace-nowrap">{i18n.t("common.update")}{formatDate(incident.updatedAt)}</span>}
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
