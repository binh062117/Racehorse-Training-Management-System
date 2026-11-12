import { Pagination } from '../../components/Pagination';
import { GroomSelect } from '../../components/GroomSelect';
import { usePagedResource } from '../../lib/usePagedResource';
import { scheduleError } from '../../lib/sessionSchedule';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../../lib/api';
import type { Paginated, TrainingMedia, TrainingPlan, TrainingSession } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, fromDateTimeLocal, toDateTimeLocal } from '../../lib/format';
import {
  Alert, Badge, Btn, Card, EmptyState, Field, Icon, ImageLightbox, Input, Modal, ModalBody, ModalFoot, ModalHead, NativeSelect, Textarea, type Tone,
} from '../../ds/ui';

const sessionTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
});

const STATUS_TONE: Record<TrainingSession['status'], Tone> = { PLANNED: 'info', DONE: 'ok', CANCELLED: 'neu', MISSED: 'warn' };

interface Props {
  horseId: string;
  isLocked?: boolean;
  lockReason?: string | null;
}

export function SessionsTab(props: Props) {
  return <SessionsContent key={props.horseId} {...props} />;
}

function SessionsContent({ horseId, isLocked }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role;
  const canCreate = role === 'TRAINER';
  const canUpdate = role === 'TRAINER';
  const canUpload = role === 'TRAINER' || role === 'GROOM';
  // Training photos / videos, grouped per session below.
  const [media, setMedia] = useState<TrainingMedia[]>([]);
  const loadMedia = useCallback(() => {
    api.get<TrainingMedia[]>(`/horses/${horseId}/media`).then((r) => setMedia(r.data)).catch(() => setMedia([]));
  }, [horseId]);
  useEffect(() => { loadMedia(); }, [loadMedia]);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansErr, setPlansErr] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadPlans = async () => {
      try {
        const all: TrainingPlan[] = [];
        let page = 1;
        while (!controller.signal.aborted) {
          const res = await api.get<Paginated<TrainingPlan>>(
            `/horses/${horseId}/training-plans`,
            { params: { page, limit: 100 }, signal: controller.signal },
          );
          all.push(...res.data.data);
          if (res.data.meta.page * res.data.meta.limit >= res.data.meta.total) break;
          page += 1;
        }
        if (!controller.signal.aborted) {
          setPlans([...new Map(all.map((plan) => [plan.id, plan])).values()]);
        }
      } catch (error) {
        if (!controller.signal.aborted) setPlansErr(error);
      } finally {
        if (!controller.signal.aborted) setPlansLoading(false);
      }
    };
    void loadPlans();
    return () => controller.abort();
  }, [horseId, attempt]);

  const retryPlans = () => {
    setPlansLoading(true);
    setPlansErr(null);
    setAttempt((value) => value + 1);
  };
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const { data: sessions, total, loading, error: err, refresh: load } = usePagedResource<TrainingSession>(
    '/horses/' + horseId + '/sessions', page, filter ? { status: filter } : {},
  );

  // Group display dates only; API ordering and stored timestamps are unchanged.
  const days = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const date = formatDate(session.scheduledAt);
    const entries = days.get(date) ?? [];
    entries.push(session);
    days.set(date, entries);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The lock itself is announced once, in the horse page's alert above the tabs. */}
      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <h2 className="text-[15px] font-semibold">{t('session.heading')}</h2>
          {isLocked && <p className="text-[13px] text-muted mt-0.5">{t('hai.locked')}</p>}
        </div>
        {canCreate && !isLocked && (
          <Btn v="p" onClick={() => { setCreated(false); setCreating(true); }}><Icon name="plus" />{t('session.openSchedule')}</Btn>
        )}
      </div>
      {created && <div role="status"><Badge tone="ok" className="h-auto py-1.5 px-3"><Icon name="check" className="w-3.5 h-3.5" />{t('session.saved')}</Badge></div>}

      <Field label={t('session.status')}><NativeSelect value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">{t('healthRecordsPage.all')}</option>{['PLANNED', 'DONE', 'CANCELLED', 'MISSED'].map((status) => <option key={status} value={status}>{t('session.displayStatus.' + status)}</option>)}</NativeSelect></Field>
      <CreateSessionForm
        open={canCreate && !isLocked && creating}
        horseId={horseId} sessions={sessions} plans={plans} plansLoading={plansLoading}
        plansErr={plansErr} retryPlans={retryPlans} onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); setCreated(true); void load(); }}
      />

      {loading ? (
        <p className="text-muted" role="status">{t('session.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : sessions.length === 0 ? (
        <EmptyState>{t('session.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[12px] text-muted -mb-2">{t('session.displayTime')}</p>
          {[...days].map(([date, entries]) => (
            <section key={date} aria-label={date}>
              <h3 className="num text-[13px] font-semibold text-muted mb-2">{date}</h3>
              <ul className="list-none p-0 flex flex-col gap-2.5">
                {entries.map((s) => (
                  <SessionItem
                    key={s.id}
                    isLocked={!!isLocked}
                    media={media.filter((m) => m.sessionId === s.id)}
                    canUpload={canUpload}
                    horseId={horseId}
                    onMediaChanged={loadMedia}
                    session={s}
                    hasPlan={!!s.planId}
                    planLabel={s.planId ? plans.find((plan) => plan.id === s.planId)?.goal ?? t('session.planUnavailable') : t('session.noPlan')}
                    canUpdate={canUpdate}
                    isTrainer={role === 'TRAINER'}
                    plans={plans}
                    allSessions={sessions}
                    onChanged={load}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Pagination page={page} total={total} onPage={setPage} disabled={loading} />
    </div>
  );
}

/** EX-01: two sessions of one horse must be at least this far apart (mirrors the API rule). */
const CONFLICT_WINDOW_MIN = 60;

/** The planned session that a time would clash with, if any — the API refuses these with 409. */
function findClash(sessions: TrainingSession[], localValue: string, excludeId?: string): TrainingSession | null {
  if (!localValue) return null;
  const at = new Date(localValue).getTime();
  if (!Number.isFinite(at)) return null;
  const windowMs = CONFLICT_WINDOW_MIN * 60_000;
  return sessions
    .filter((s) => s.status === 'PLANNED' && s.id !== excludeId)
    .filter((s) => Math.abs(new Date(s.scheduledAt).getTime() - at) <= windowMs)
    .sort((a, b) => Math.abs(new Date(a.scheduledAt).getTime() - at) - Math.abs(new Date(b.scheduledAt).getTime() - at))[0] ?? null;
}

function ClashWarning({ clash }: { clash: TrainingSession | null }) {
  const { t } = useTranslation();
  if (!clash) return null;
  return (
    <Alert tone="warn" icon="alert" title={t('mergeUi.scheduleClash')}>
      {t('errorDetails.sessionClash', { type: clash.type, time: `${sessionTime.format(new Date(clash.scheduledAt))} ${formatDate(clash.scheduledAt)}`, minutes: CONFLICT_WINDOW_MIN })}
    </Alert>
  );
}

function CreateSessionForm({
  open, horseId, sessions, onCreated, onClose, plans, plansLoading, plansErr, retryPlans,
}: {
  open: boolean;
  horseId: string;
  sessions: TrainingSession[];
  onCreated: () => void;
  onClose: () => void;
  plans: TrainingPlan[];
  plansLoading: boolean;
  plansErr: unknown;
  retryPlans: () => void;
}) {
  const { t } = useTranslation();
  const [scheduledAt, setScheduledAt] = useState('');
  const [type, setType] = useState('');
  const [distanceM, setDistanceM] = useState('');
  const [surface, setSurface] = useState('');
  const [notes, setNotes] = useState('');
  const [planId, setPlanId] = useState('');
  const [groomId, setGroomId] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [validation, setValidation] = useState('');
  const [busy, setBusy] = useState(false);
  const clash = findClash(sessions, scheduledAt);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || clash) return;
    setErr(null);
    setValidation('');
    if (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime())) {
      setValidation('session.invalidDate');
      return;
    }
    const timeError = scheduleError(scheduledAt, plans.find((p) => p.id === planId));
    if (timeError) { setValidation(timeError); return; }
    if (!type.trim() || type.trim().length > 80 || notes.length > 2000) {
      setValidation('session.invalidFields');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/horses/${horseId}/sessions`, {
        scheduledAt: fromDateTimeLocal(scheduledAt),
        type: type.trim(),
        ...(distanceM ? { distanceM: Number(distanceM) } : {}),
        ...(surface ? { surface: surface.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(planId ? { planId } : {}),
        groomId: groomId || null,
      });
      setScheduledAt('');
      setType('');
      setDistanceM('');
      setSurface('');
      setNotes('');
      setPlanId('');
      setGroomId('');
      onCreated();
    } catch (error) {
      setErr(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} labelledBy="session-new-title">
      <ModalHead icon="calendar" title={t('session.new')} id="session-new-title" onClose={() => !busy && onClose()} />
      <form onSubmit={submit} aria-label={t('session.new')}>
        <ModalBody>
          <Field label={t('session.scheduledAt')} hint={t('session.localTime', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
            <Input type="datetime-local" min={toDateTimeLocal(new Date().toISOString())} autoFocus value={scheduledAt} onChange={(e) => { e.currentTarget.setCustomValidity(''); setScheduledAt(e.target.value); }} onInvalid={(e) => { if (e.currentTarget.validity.rangeUnderflow) e.currentTarget.setCustomValidity(t('hai.pastTime')); }} disabled={busy} required err={!!clash} />
          </Field>
          <ClashWarning clash={clash} />
          <Field label={t('session.plan')}>
            <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy || plansLoading || !!plansErr}>
              <option value="">{t('session.noPlan')}</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.goal} ({formatDate(plan.startDate)})</option>)}
            </NativeSelect>
          </Field>
          {plansLoading && <p className="cap" role="status">{t('session.loadingPlans')}</p>}
          {plansErr != null && (
            <div>
              <ErrorText err={plansErr} />
              <p className="cap">{t('session.planLoadFailed')}</p>
              <Btn sm disabled={busy} onClick={retryPlans}>{t('session.retry')}</Btn>
            </div>
          )}
          {open && <GroomSelect value={groomId} onChange={setGroomId} disabled={busy} />}
          <Field label={t('session.type')}>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder={t('hai.typePlaceholder')} maxLength={80} disabled={busy} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cự ly (mét)">
              <input
                className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                type="number"
                value={distanceM}
                onChange={(e) => setDistanceM(e.target.value)}
                placeholder="vd: 1200, 1600"
                min={100}
                max={10000}
                disabled={busy}
              />
            </Field>
            <Field label="Mặt sân">
              <select
                className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                disabled={busy}
              >
                <option value="">Chọn mặt sân</option>
                <option value="TURF">Cỏ (Turf)</option>
                <option value="DIRT">Cát (Dirt)</option>
                <option value="SYNTHETIC">Nhân tạo (Synthetic)</option>
              </select>
            </Field>
          </div>
          <Field label={t('session.notes')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={busy} rows={2} />
          </Field>
          {validation && <p className="text-bad font-medium text-[13px]" role="alert">{t(validation)}</p>}
          <ErrorText err={err} />
        </ModalBody>
        <ModalFoot>
          <Btn disabled={busy} onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || !!clash}>{t('session.schedule')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}

const RESULT_WINDOW_MS = 24 * 3600_000;
const MUSCLE = ['NORMAL', 'TIGHT', 'SORE'] as const;

function SessionItem({ session, planLabel, hasPlan, canUpdate, isTrainer, allSessions, plans, onChanged, isLocked, media, canUpload, horseId, onMediaChanged }: {
  isLocked: boolean;
  media: TrainingMedia[];
  canUpload: boolean;
  horseId: string;
  onMediaChanged: () => void;
  session: TrainingSession;
  planLabel: string;
  hasPlan: boolean;
  canUpdate: boolean;
  isTrainer: boolean;
  allSessions: TrainingSession[];
  plans: TrainingPlan[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'DONE' | 'CANCELLED' | ''>('');
  const [resultMetric, setResultMetric] = useState(session.resultMetric ?? '');
  const [resultValue, setResultValue] = useState(session.resultValue?.toString() ?? '');
  const [finishTime, setFinishTime] = useState(session.finishTimeSec?.toString() ?? '');
  const [recoveryHr, setRecoveryHr] = useState(session.recoveryHeartRate?.toString() ?? '');
  const [muscle, setMuscle] = useState<string>(session.muscleResponse ?? '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const [groomId, setGroomId] = useState(session.groomId ?? '');
  const [planId, setPlanId] = useState(session.planId ?? '');
  const [validation, setValidation] = useState('');
  const originalTime = toDateTimeLocal(session.scheduledAt);
  const [when, setWhen] = useState(originalTime);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // Rescheduling needs a session still ahead; results can be recorded up to 24h after it.
  const at = new Date(session.scheduledAt).getTime();
  const ahead = at > Date.now();
  const editable = canUpdate && session.status === 'PLANNED' && at > Date.now() - RESULT_WINDOW_MS;
  const hasResult = finishTime.trim() !== '' || recoveryHr.trim() !== '' || muscle !== '' || (resultMetric.trim() !== '' && resultValue.trim() !== '');
  // Only a trainer reschedules, and only while the session stays planned (EX-01 applies to planned sessions).
  const moving = isTrainer && ahead && !status && when !== originalTime;
  const clash = moving ? findClash(allSessions, when, session.id) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || clash) return;
    setValidation('');
    if (status === 'DONE' && !hasResult) { setValidation('sessionResult.needOne'); return; }
    if (moving || planId !== (session.planId ?? '')) {
      const timeError = scheduleError(when, plans.find((p) => p.id === planId));
      if (timeError) { setValidation(timeError); return; }
    }
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (isTrainer && groomId !== (session.groomId ?? '')) body.groomId = groomId || null;
    if (isTrainer && planId !== (session.planId ?? '')) body.planId = planId || null;
    if (moving && when) body.scheduledAt = fromDateTimeLocal(when);
    if (status) body.status = status;
    if (resultMetric.trim()) body.resultMetric = resultMetric.trim();
    if (resultValue.trim()) body.resultValue = Number(resultValue);
    if (finishTime.trim()) body.finishTimeSec = Number(finishTime);
    if (recoveryHr.trim()) body.recoveryHeartRate = Number(recoveryHr);
    if (muscle) body.muscleResponse = muscle;
    if (isTrainer && notes !== (session.notes ?? '')) body.notes = notes.trim();
    try {
      await api.patch(`/sessions/${session.id}`, body);
      setEditing(false);
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <Card className="p-4 flex gap-4">
        <time className="num w-[52px] flex-none text-[18px] leading-6 font-semibold" dateTime={session.scheduledAt}>
          {sessionTime.format(new Date(session.scheduledAt))}
        </time>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold leading-6">{session.type}</span>
              {session.distanceM != null && <Badge tone="neu"><span className="num">{session.distanceM} m</span></Badge>}
              {session.surface && <Badge tone="info">{session.surface === 'TURF' ? t('races.surfaceTurf', 'Cỏ') : session.surface === 'DIRT' ? t('races.surfaceDirt', 'Cát') : session.surface}</Badge>}
            </div>
            <Badge tone={STATUS_TONE[session.status]}>{t(`session.displayStatus.${session.status}`)}</Badge>
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
            <dt className="text-muted">{t('session.planSummary')}</dt>
            <dd className={hasPlan ? '' : 'text-muted'}>{planLabel}</dd>
            <dt className="text-muted">{t('session.trainer')}</dt>
            <dd>{session.trainer.name}</dd>
            <dt className="text-muted">{t('hai.assignedGroom')}</dt><dd>{session.groom?.name ?? t('hai.unassigned')}</dd>
            {session.notes && <><dt className="text-muted">{t('session.notes')}</dt><dd>{session.notes}</dd></>}
            {session.finishTimeSec != null && <><dt className="text-muted">{t('sessionResult.finishTime')}</dt><dd className="num">{session.finishTimeSec} s</dd></>}
            {session.recoveryHeartRate != null && <><dt className="text-muted">{t('sessionResult.recoveryHr')}</dt><dd className="num">{session.recoveryHeartRate} bpm</dd></>}
            {session.muscleResponse && <><dt className="text-muted">{t('sessionResult.muscle')}</dt><dd>{t(`sessionResult.muscleValue.${session.muscleResponse}`)}</dd></>}
            {(session.resultMetric || session.resultValue != null) && (
              <><dt className="text-muted">{t('session.result')}</dt><dd className="num">{session.resultMetric ?? t('hai.metric')}: <strong>{session.resultValue ?? t('hai.noResult')}</strong></dd></>
            )}
          </dl>

          {isLocked && session.status === 'PLANNED' && ahead && (
            <p className="mt-2 text-[12.5px] text-warn font-medium">{t('sessionResult.lockedHold')}</p>
          )}
          {session.status === 'PLANNED' && !ahead && editable && (
            <p className="mt-2 text-[12.5px] text-info">{t('sessionResult.recordNow')}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editable && !editing && <Btn sm onClick={() => setEditing(true)}>{ahead ? t('common.update') : t('sessionResult.record')}</Btn>}
            {canUpload && <MediaUpload horseId={horseId} sessionId={session.id} onDone={onMediaChanged} />}
          </div>
          {media.length > 0 && <MediaStrip media={media} />}

        {editing && (
          <form onSubmit={save} className="flex flex-col gap-3 mt-3.5 pt-3.5 border-t border-line-soft">
            <Field label={t('session.status')}>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as 'DONE' | 'CANCELLED' | '')}>
                <option value="">{t('session.keepPlanned')}</option>
                {/* Results only once the session has taken place */}
                {!ahead && <option value="DONE">{t('session.displayStatus.DONE')}</option>}
                <option value="CANCELLED">{t('session.displayStatus.CANCELLED')}</option>
              </NativeSelect>
            </Field>
            {isTrainer && !status && ahead && (
              <>
                <Field label={t('session.scheduledAt')} hint={t('hai.rescheduleHint')}>
                  <Input type="datetime-local" min={toDateTimeLocal(new Date().toISOString())} value={when} onChange={(e) => { e.currentTarget.setCustomValidity(''); setWhen(e.target.value); }} onInvalid={(e) => { if (e.currentTarget.validity.rangeUnderflow) e.currentTarget.setCustomValidity(t('hai.pastTime')); }} err={!!clash} required />
                </Field>
                <ClashWarning clash={clash} />
              </>
            )}
            {isTrainer && <>
              <GroomSelect value={groomId} onChange={setGroomId} disabled={busy} />
              <Field label={t('session.plan')}><NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy}>
                <option value="">{t('session.noPlan')}</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.goal}</option>)}
              </NativeSelect></Field>
            </>}
            {validation && <p role="alert" className="text-bad">{t(validation)}</p>}
            {status === 'DONE' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t('sessionResult.finishTime')} hint={t('sessionResult.finishTimeHint')}>
                  <Input type="number" min="1" step="0.1" value={finishTime} onChange={(e) => setFinishTime(e.target.value)} />
                </Field>
                <Field label={t('sessionResult.recoveryHr')} hint={t('sessionResult.recoveryHrHint')}>
                  <Input type="number" min="20" max="250" value={recoveryHr} onChange={(e) => setRecoveryHr(e.target.value)} />
                </Field>
                <Field label={t('sessionResult.muscle')}>
                  <NativeSelect value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                    <option value="">{t('sessionResult.notRecorded')}</option>
                    {MUSCLE.map((m) => <option key={m} value={m}>{t(`sessionResult.muscleValue.${m}`)}</option>)}
                  </NativeSelect>
                </Field>
              </div>
            )}
            {status === 'DONE' && (
              <details className="text-[13px]">
                <summary className="cursor-pointer text-muted">{t('sessionResult.otherMetric')}</summary>
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
                  <Field label={t('session.resultMetric')}><Input value={resultMetric} onChange={(e) => setResultMetric(e.target.value)} placeholder="heart_rate_max" /></Field>
                  <Field label={t('session.resultValue')}><Input type="number" step="any" value={resultValue} onChange={(e) => setResultValue(e.target.value)} /></Field>
                </div>
              </details>
            )}
            {isTrainer && <Field label={t('session.notes')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>}
            <ErrorText err={err} />
            <div className="flex gap-2">
              <Btn v="p" sm type="submit" disabled={busy || !!clash}>{t('common.save')}</Btn>
              <Btn sm onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Btn>
            </div>
          </form>
        )}
        </div>
      </Card>
    </li>
  );
}

/** Add a photo or video to a session — the owner sees it in the monthly report. */
function MediaUpload({ horseId, sessionId, onDone }: { horseId: string; sessionId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setErr(new Error(t('media.tooBig'))); return; }
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.append('file', file);
    form.append('sessionId', sessionId);
    try {
      await api.post(`/horses/${horseId}/media`, form);
      onDone();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <Btn sm v="g" disabled={busy} onClick={() => ref.current?.click()}><Icon name="camera" className="w-3.5 h-3.5" />{busy ? t('media.uploading') : t('media.add')}</Btn>
      {err != null && <span className="w-full"><ErrorText err={err} /></span>}
    </>
  );
}

export function MediaStrip({ media }: { media: TrainingMedia[] }) {
  const [open, setOpen] = useState<TrainingMedia | null>(null);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {media.map((m) => (
        <button key={m.id} type="button" onClick={() => setOpen(m)} className="w-16 h-16 rounded-badge overflow-hidden border border-line bg-subtle relative cursor-zoom-in" title={m.caption ?? ''}>
          {m.kind === 'VIDEO'
            ? <><video src={getFileUrl(m.url) ?? undefined} className="w-full h-full object-cover" muted preload="metadata" /><span className="absolute inset-0 flex items-center justify-center text-white text-[18px] bg-black/25">▶</span></>
            : <img src={getFileUrl(m.url) ?? undefined} alt={m.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />}
        </button>
      ))}
      {open && (open.kind === 'VIDEO'
        ? <Modal open onClose={() => setOpen(null)} width={860}><video src={getFileUrl(open.url) ?? undefined} controls autoPlay className="w-full max-h-[80vh] bg-black" /></Modal>
        : <ImageLightbox src={getFileUrl(open.url) ?? ''} alt={open.caption ?? ''} open onClose={() => setOpen(null)} />)}
    </div>
  );
}
