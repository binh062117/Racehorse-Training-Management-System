import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Paginated, TrainingPlan, TrainingSession } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, fromDateTimeLocal, toDateTimeLocal } from '../../lib/format';
import {
  Alert, Badge, Btn, Card, EmptyState, Field, Icon, Input, Modal, ModalBody, ModalFoot, ModalHead, NativeSelect, Textarea, type Tone,
} from '../../ds/ui';

const sessionTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
});

const STATUS_TONE: Record<TrainingSession['status'], Tone> = { PLANNED: 'info', DONE: 'ok', CANCELLED: 'neu' };

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
  const canUpdate = role === 'TRAINER' || role === 'GROOM';

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
  const [sessions, setSessions] = useState<(TrainingSession & { planId?: string | null })[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const all: (TrainingSession & { planId?: string | null })[] = [];
      let page = 1;
      while (!signal?.aborted) {
        const res = await api.get<Paginated<TrainingSession & { planId?: string | null }>>(
          `/horses/${horseId}/sessions`,
          { params: { page, limit: 100 }, signal },
        );
        all.push(...res.data.data);
        if (res.data.meta.page * res.data.meta.limit >= res.data.meta.total) break;
        page += 1;
      }
      if (!signal?.aborted) {
        setSessions([...new Map(all.map((session) => [session.id, session])).values()]);
        setErr(null);
      }
    } catch (error) {
      if (!signal?.aborted) setErr(error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [horseId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

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
          {isLocked && <p className="text-[13px] text-muted mt-0.5">Đang khóa tập — chưa thể lên lịch buổi mới.</p>}
        </div>
        {canCreate && !isLocked && (
          <Btn v="p" onClick={() => { setCreated(false); setCreating(true); }}><Icon name="plus" />{t('session.openSchedule')}</Btn>
        )}
      </div>
      {created && <div role="status"><Badge tone="ok" className="h-auto py-1.5 px-3"><Icon name="check" className="w-3.5 h-3.5" />{t('session.saved')}</Badge></div>}

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
                    session={s}
                    hasPlan={!!s.planId}
                    planLabel={s.planId ? plans.find((plan) => plan.id === s.planId)?.goal ?? t('session.planUnavailable') : t('session.noPlan')}
                    canUpdate={canUpdate}
                    isTrainer={role === 'TRAINER'}
                    allSessions={sessions}
                    onChanged={load}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
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
  const [notes, setNotes] = useState('');
  const [planId, setPlanId] = useState('');
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
    if (!type.trim() || type.trim().length > 80 || notes.length > 2000) {
      setValidation('session.invalidFields');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/horses/${horseId}/sessions`, {
        scheduledAt: fromDateTimeLocal(scheduledAt),
        type: type.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(planId ? { planId } : {}),
      });
      setScheduledAt('');
      setType('');
      setNotes('');
      setPlanId('');
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
            <Input type="datetime-local" autoFocus value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={busy} required err={!!clash} />
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
          <Field label={t('session.type')}>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Ví dụ: Chạy nước rút, Chạy sức bền…" maxLength={80} disabled={busy} required />
          </Field>
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

function SessionItem({ session, planLabel, hasPlan, canUpdate, isTrainer, allSessions, onChanged }: {
  session: TrainingSession;
  planLabel: string;
  hasPlan: boolean;
  canUpdate: boolean;
  isTrainer: boolean;
  allSessions: TrainingSession[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'DONE' | 'CANCELLED' | ''>('');
  const [resultMetric, setResultMetric] = useState(session.resultMetric ?? '');
  const [resultValue, setResultValue] = useState(session.resultValue?.toString() ?? '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const originalTime = toDateTimeLocal(session.scheduledAt);
  const [when, setWhen] = useState(originalTime);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const editable = canUpdate && session.status === 'PLANNED';
  // Only a trainer reschedules, and only while the session stays planned (EX-01 applies to planned sessions).
  const moving = isTrainer && !status && when !== originalTime;
  const clash = moving ? findClash(allSessions, when, session.id) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (clash) return;
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (moving && when) body.scheduledAt = fromDateTimeLocal(when);
    if (status) body.status = status;
    if (resultMetric.trim()) body.resultMetric = resultMetric.trim();
    if (resultValue.trim()) body.resultValue = Number(resultValue);
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
            <div className="font-semibold leading-6">{session.type}</div>
            <Badge tone={STATUS_TONE[session.status]}>{t(`session.displayStatus.${session.status}`)}</Badge>
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
            <dt className="text-muted">{t('session.planSummary')}</dt>
            <dd className={hasPlan ? '' : 'text-muted'}>{planLabel}</dd>
            <dt className="text-muted">{t('session.trainer')}</dt>
            <dd>{session.trainer.name}</dd>
            {session.notes && <><dt className="text-muted">{t('session.notes')}</dt><dd>{session.notes}</dd></>}
            {(session.resultMetric || session.resultValue != null) && (
              <><dt className="text-muted">{t('session.result')}</dt><dd className="num">{session.resultMetric ?? 'Chỉ số'}: <strong>{session.resultValue ?? 'Chưa có'}</strong></dd></>
            )}
          </dl>

          {editable && !editing && <Btn sm className="mt-3" onClick={() => setEditing(true)}>{t('common.update')}</Btn>}

        {editing && (
          <form onSubmit={save} className="flex flex-col gap-3 mt-3.5 pt-3.5 border-t border-line-soft">
            <Field label={t('session.status')}>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as 'DONE' | 'CANCELLED' | '')}>
                <option value="">{t('session.keepPlanned')}</option>
                <option value="DONE">{t('session.displayStatus.DONE')}</option>
                <option value="CANCELLED">{t('session.displayStatus.CANCELLED')}</option>
              </NativeSelect>
            </Field>
            {isTrainer && !status && (
              <>
                <Field label="Giờ tập" hint="Dời giờ khi lịch thay đổi — buổi tập vẫn ở trạng thái đã lên lịch.">
                  <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} err={!!clash} required />
                </Field>
                <ClashWarning clash={clash} />
              </>
            )}
            <Field label={t('session.resultMetric')}>
              <Input value={resultMetric} onChange={(e) => setResultMetric(e.target.value)} placeholder="Ví dụ: thời gian 1200m (giây)" />
            </Field>
            <Field label={t('session.resultValue')}>
              <Input type="number" step="any" value={resultValue} onChange={(e) => setResultValue(e.target.value)} />
            </Field>
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
