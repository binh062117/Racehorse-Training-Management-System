import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../lib/api';
import type { Paginated, TrainingPlan, TrainingSession } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, fromDateTimeLocal } from '../../lib/format';
import { LockIcon } from '../../components/Icons';
import './SessionsTab.css';

const sessionTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
});

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
    <div className="stack session-schedule">
      {isLocked && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'var(--status-danger-bg)',
            border: '1px solid #f5c2c7',
            borderRadius: 6,
            color: 'var(--status-danger)',
            fontSize: '13px',
          }}
        >
          <LockIcon width="18" height="18" />
          <div>
            <strong>{t('session.locked')}</strong>
            {lockReason && <div>{lockReason}</div>}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{t('session.heading')}</h2>
        {canCreate && !isLocked && (
          <button type="button" className="btn btn-primary" onClick={() => {
            setCreated(false);
            setCreating(true);
          }}>+ {t('session.openSchedule')}</button>
        )}
      </div>
      {created && <p className="badge badge-success schedule-success" role="status">{t('session.saved')}</p>}
      {canCreate && !isLocked && creating && (
        <CreateSessionForm horseId={horseId} plans={plans} plansLoading={plansLoading}
          plansErr={plansErr} retryPlans={retryPlans} onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); setCreated(true); void load(); }} />
      )}

      <p className="muted small schedule-timezone">{t('session.displayTime')}</p>
      {loading ? (
        <p className="muted" role="status">{t('session.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : sessions.length === 0 ? (
        <p className="muted">{t('session.empty')}</p>
      ) : (
        <div className="schedule-days">
          {[...days].map(([date, entries]) => (
            <section className="schedule-day" key={date} aria-label={date}>
              <h3 className="schedule-date">{date}</h3>
        <ul className="schedule-day-list">
          {entries.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              hasPlan={!!s.planId}
              planLabel={s.planId
                ? plans.find((plan) => plan.id === s.planId)?.goal ?? t('session.planUnavailable')
                : t('session.noPlan')}
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
  horseId,
  onCreated,
  onClose,
  plans,
  plansLoading,
  plansErr,
  retryPlans,
}: {
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
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label={t('session.new')}
        style={{ minWidth: 0 }} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) onClose();
          if (e.key === 'Tab') {
            const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'));
            const first = controls[0], last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
          }
        }}>
        <div className="modal-header">
          <h2 className="modal-title">{t('session.new')}</h2>
          <button type="button" className="modal-close" disabled={busy}
            aria-label={t('session.closeSchedule')} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} aria-label={t('session.new')}>
          <div className="modal-body form-grid" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Field label={t('session.scheduledAt')} hint={t('session.localTime', {
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })}>
        <input
          className="input"
          type="datetime-local"
          autoFocus
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          disabled={busy}
          required
        />
      </Field>
      <Field label={t('session.plan')}>
        <select className="input" value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          disabled={busy || plansLoading || !!plansErr}>
          <option value="">{t('session.noPlan')}</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.goal} ({formatDate(plan.startDate)})
            </option>
          ))}
        </select>
      </Field>
      {plansLoading && <p className="muted" role="status">{t('session.loadingPlans')}</p>}
      {plansErr && (
        <div>
          <ErrorText err={plansErr} />
          <p className="muted small">{t('session.planLoadFailed')}</p>
          <button type="button" className="btn" disabled={busy} onClick={retryPlans}>{t('session.retry')}</button>
        </div>
      )}
      <Field label={t('session.type')}>
        <input
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="gallop, sprint, trot…"
          maxLength={80}
          disabled={busy}
          required
        />
      </Field>
      <Field label={t('session.notes')}>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          disabled={busy}
          rows={2}
        />
      </Field>
      {validation && <p className="error" role="alert">{t(validation)}</p>}
      <ErrorText err={err} />
      {err != null && apiErrorMessage(err) && (
        <p className="error" role="alert">{apiErrorMessage(err)}</p>
      )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{t('session.schedule')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionItem({
  session,
  planLabel,
  hasPlan,
  canUpdate,
  isTrainer,
  onChanged,
}: {
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
  const [resultValue, setResultValue] = useState(
    session.resultValue?.toString() ?? '',
  );
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
    <li className="card">
      <div className="schedule-summary">
        <div className="schedule-summary-head">
          <time className="schedule-time" dateTime={session.scheduledAt}>
            {sessionTime.format(new Date(session.scheduledAt))}
          </time>
          <div className="schedule-type-status">
            <strong className="schedule-type">{session.type}</strong>
            <span className={`badge ${session.status === 'PLANNED' ? 'badge-info' : session.status === 'DONE' ? 'badge-success' : 'badge-neutral'}`}>
              {t(`session.displayStatus.${session.status}`)}
            </span>
          </div>
        </div>
        <div className="schedule-description">
          <div className="schedule-plan-label">{t('session.planSummary')}</div>
          <div className={hasPlan ? 'schedule-plan' : 'schedule-plan muted'}>{planLabel}</div>
          <div className="schedule-trainer">{t('session.trainer')}: {session.trainer.name}</div>
          {session.notes && <div className="schedule-notes">{t('session.notes')}: {session.notes}</div>}
        </div>
      </div>
      {(session.resultMetric || session.resultValue != null) && (
        <div className="small">
          {t('session.result')}: {session.resultMetric ?? '—'} ={' '}
          {session.resultValue ?? '—'}
        </div>
      )}

      {editable && !editing && (
        <button
          type="button"
          className="btn small-btn"
          onClick={() => setEditing(true)}
        >
          {t('common.update')}
        </button>
      )}

      {editing && (
        <form className="form-grid mt" onSubmit={save}>
          <Field label={t('session.status')}>
            <select
              className="input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'DONE' | 'CANCELLED' | '')
              }
            >
              <option value="">{t('session.keepPlanned')}</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </Field>
          <Field label={t('session.resultMetric')}>
            <input
              className="input"
              value={resultMetric}
              onChange={(e) => setResultMetric(e.target.value)}
              placeholder="time_1200m_s"
            />
          </Field>
          <Field label={t('session.resultValue')}>
            <input
              className="input"
              type="number"
              step="any"
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
            />
          </Field>
          {isTrainer && (
            <Field label={t('session.notes')}>
              <textarea
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>
          )}
          <ErrorText err={err} />
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('common.save')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
