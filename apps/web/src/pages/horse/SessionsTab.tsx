import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../lib/api';
import type { Paginated, TrainingPlan, TrainingSession } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, fromDateTimeLocal } from '../../lib/format';
import {
  Alert, Badge, Btn, Card, Field, Icon, Modal, ModalBody, ModalFoot, ModalHead, Textarea, type Tone,
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

function SessionsContent({ horseId, isLocked, lockReason }: Props) {
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
      {isLocked && (
        <Alert tone="bad" icon="lock" title={t('session.locked')}>
          {lockReason}
        </Alert>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <h2 className="text-[15px] font-semibold">{t('session.heading')}</h2>
        {canCreate && !isLocked && (
          <Btn v="p" onClick={() => { setCreated(false); setCreating(true); }}><Icon name="plus" />{t('session.openSchedule')}</Btn>
        )}
      </div>
      {created && <div role="status"><Badge tone="ok" className="h-auto py-1.5 px-3"><Icon name="check" className="w-3.5 h-3.5" />{t('session.saved')}</Badge></div>}

      <CreateSessionForm
        open={canCreate && !isLocked && creating}
        horseId={horseId} plans={plans} plansLoading={plansLoading}
        plansErr={plansErr} retryPlans={retryPlans} onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); setCreated(true); void load(); }}
      />

      <p className="cap">{t('session.displayTime')}</p>
      {loading ? (
        <p className="cap" role="status">{t('session.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : sessions.length === 0 ? (
        <p className="cap">{t('session.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...days].map(([date, entries]) => (
            <section key={date} aria-label={date}>
              <h3 className="lbl mb-2">{date}</h3>
              <ul className="list-none p-0 flex flex-col gap-2.5">
                {entries.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    hasPlan={!!s.planId}
                    planLabel={s.planId ? plans.find((plan) => plan.id === s.planId)?.goal ?? t('session.planUnavailable') : t('session.noPlan')}
                    canUpdate={canUpdate}
                    isTrainer={role === 'TRAINER'}
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

function CreateSessionForm({
  open, horseId, onCreated, onClose, plans, plansLoading, plansErr, retryPlans,
}: {
  open: boolean;
  horseId: string;
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
  const [err, setErr] = useState<unknown>(null);
  const [validation, setValidation] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
        ...(distanceM ? { distanceM: Number(distanceM) } : {}),
        ...(surface ? { surface: surface.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(planId ? { planId } : {}),
      });
      setScheduledAt('');
      setType('');
      setDistanceM('');
      setSurface('');
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
            <input
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              type="datetime-local" autoFocus value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={busy} required
            />
          </Field>
          <Field label={t('session.plan')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy || plansLoading || !!plansErr}
            >
              <option value="">{t('session.noPlan')}</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.goal} ({formatDate(plan.startDate)})</option>)}
            </select>
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
            <input
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={type} onChange={(e) => setType(e.target.value)} placeholder="gallop, sprint, trot…" maxLength={80} disabled={busy} required
            />
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
          {err != null && apiErrorMessage(err) && <p className="text-bad font-medium text-[13px]" role="alert">{apiErrorMessage(err)}</p>}
        </ModalBody>
        <ModalFoot>
          <Btn disabled={busy} onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{t('session.schedule')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}

function SessionItem({ session, planLabel, hasPlan, canUpdate, isTrainer, onChanged }: {
  session: TrainingSession;
  planLabel: string;
  hasPlan: boolean;
  canUpdate: boolean;
  isTrainer: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'DONE' | 'CANCELLED' | ''>('');
  const [resultMetric, setResultMetric] = useState(session.resultMetric ?? '');
  const [resultValue, setResultValue] = useState(session.resultValue?.toString() ?? '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const editable = canUpdate && session.status === 'PLANNED';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
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
      <Card className="p-4">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <time className="disp text-2xl" dateTime={session.scheduledAt}>{sessionTime.format(new Date(session.scheduledAt))}</time>
          <div className="flex items-center gap-2">
            <strong>{session.type}</strong>
            {session.distanceM != null && (
              <span className="inline-flex items-center h-[20px] px-2 rounded-badge text-[10.5px] font-semibold bg-subtle text-ink">
                {session.distanceM}m
              </span>
            )}
            {session.surface && (
              <span className="inline-flex items-center h-[20px] px-2 rounded-badge text-[10.5px] font-semibold bg-cream text-navy">
                {session.surface === 'TURF' ? 'Cỏ' : session.surface === 'DIRT' ? 'Cát' : session.surface}
              </span>
            )}
            <Badge tone={STATUS_TONE[session.status]}>{t(`session.displayStatus.${session.status}`)}</Badge>
          </div>
        </div>
        <div className="mt-2 text-[13px]">
          <div className="lbl">{t('session.planSummary')}</div>
          <div className={hasPlan ? '' : 'cap'}>{planLabel}</div>
          <div className="cap mt-0.5">{t('session.trainer')}: {session.trainer.name}</div>
          {session.notes && <div className="cap mt-0.5">{t('session.notes')}: {session.notes}</div>}
        </div>
        {(session.resultMetric || session.resultValue != null) && (
          <div className="text-[12.5px] mt-1.5">{t('session.result')}: {session.resultMetric ?? '—'} = {session.resultValue ?? '—'}</div>
        )}

        {editable && !editing && <Btn sm className="mt-2.5" onClick={() => setEditing(true)}>{t('common.update')}</Btn>}

        {editing && (
          <form onSubmit={save} className="flex flex-col gap-3 mt-3.5 pt-3.5 border-t border-line-soft">
            <Field label={t('session.status')}>
              <select
                className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                value={status} onChange={(e) => setStatus(e.target.value as 'DONE' | 'CANCELLED' | '')}
              >
                <option value="">{t('session.keepPlanned')}</option>
                <option value="DONE">DONE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </Field>
            <Field label={t('session.resultMetric')}>
              <input
                className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                value={resultMetric} onChange={(e) => setResultMetric(e.target.value)} placeholder="time_1200m_s"
              />
            </Field>
            <Field label={t('session.resultValue')}>
              <input
                className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                type="number" step="any" value={resultValue} onChange={(e) => setResultValue(e.target.value)}
              />
            </Field>
            {isTrainer && <Field label={t('session.notes')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>}
            <ErrorText err={err} />
            <div className="flex gap-2">
              <Btn v="p" sm type="submit" disabled={busy}>{t('common.save')}</Btn>
              <Btn sm onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Btn>
            </div>
          </form>
        )}
      </Card>
    </li>
  );
}
