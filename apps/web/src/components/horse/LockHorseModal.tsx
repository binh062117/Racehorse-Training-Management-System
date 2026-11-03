import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, HorseLockEvent } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { HealthRecordPicker } from '../health/HealthRecordPicker';
import { Alert, Btn, Field, Modal, ModalBody, ModalFoot, ModalHead, Textarea } from '../../ds/ui';
import { lockReasonText } from '../../ds/ui';

/**
 * VET locks or unlocks training for a horse.
 * - Lock: a reason is required.
 * - Unlock: pick an exam written after the lock began that concludes the
 *   horse is healthy (the API enforces the same rule).
 */
export function LockHorseModal({ horse, open, onClose, onDone }: { horse: Horse; open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const unlocking = horse.locked;
  const [reason, setReason] = useState('');
  const [recordId, setRecordId] = useState('');
  const [lockedSince, setLockedSince] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (!open || !unlocking) return;
    api.get<HorseLockEvent[]>(`/horses/${horse.id}/lock-events`)
      .then((r) => setLockedSince(r.data.find((e) => e.locked)?.createdAt ?? null))
      .catch(() => setLockedSince(null));
  }, [open, unlocking, horse.id]);

  const close = () => {
    if (busy) return;
    setReason('');
    setRecordId('');
    setErr(null);
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/horses/${horse.id}/lock`, unlocking
        ? { locked: false, healthRecordId: recordId, ...(reason.trim() ? { reason: reason.trim() } : {}) }
        : { locked: true, reason: reason.trim() });
      setReason('');
      setRecordId('');
      onDone();
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const ready = unlocking ? !!recordId : reason.trim().length > 0;

  return (
    <Modal open={open} onClose={close} labelledBy="lock-horse-title" width={600}>
      <ModalHead id="lock-horse-title" tone={unlocking ? 'info' : 'bad'}
        title={unlocking ? t('lock.unlockTitle', { horse: horse.name }) : t('lock.lockTitle', { horse: horse.name })}
        sub={unlocking ? t('lock.unlockSub') : t('lock.lockSub')} onClose={close} />
      <ModalBody>
        {unlocking ? (
          <>
            <Alert tone="bad" icon="lock" title={t('lock.currentReason')}>{lockReasonText(horse.lockReason)}</Alert>
            <div>
              <div className="text-[13px] font-medium mb-1.5">{t('lock.evidence')} <span className="text-bad">*</span></div>
              <HealthRecordPicker horseId={horse.id} horseName={horse.name} value={recordId} onChange={setRecordId} requireFit after={lockedSince} canCreate />
            </div>
            <Field label={t('lock.unlockNote')}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder={t('lock.unlockNotePlaceholder')} />
            </Field>
          </>
        ) : (
          <Field label={t('lock.reason')} req hint={t('lock.reasonHint')}>
            <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder={t('lock.reasonPlaceholder')} />
          </Field>
        )}
        <ErrorText err={err} />
      </ModalBody>
      <ModalFoot>
        <Btn onClick={close} disabled={busy}>{t('common.cancel')}</Btn>
        <Btn v={unlocking ? 'p' : 'd'} onClick={() => void submit()} disabled={busy || !ready}>
          {busy ? t('lock.saving') : unlocking ? t('lock.unlockConfirm') : t('lock.lockConfirm')}
        </Btn>
      </ModalFoot>
    </Modal>
  );
}

/** Every lock / unlock of the horse, newest first — the reason stays after an unlock. */
export function LockHistory({ horseId, refreshKey }: { horseId: string; refreshKey?: unknown }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<HorseLockEvent[] | null>(null);
  useEffect(() => {
    api.get<HorseLockEvent[]>(`/horses/${horseId}/lock-events`)
      .then((r) => setEvents(r.data))
      .catch(() => setEvents([]));
  }, [horseId, refreshKey]);

  if (!events || events.length === 0) return null;
  const when = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <section className="bg-white border border-line rounded-card">
      <div className="px-5 py-3.5 border-b border-line-soft"><h3 className="text-[15px] font-semibold">{t('lock.historyTitle')}</h3></div>
      <ol className="list-none m-0 p-0">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 px-5 py-3 border-b border-line-soft last:border-0">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-none ${e.locked ? 'bg-bad' : 'bg-ok'}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{e.locked ? t('lock.eventLocked') : t('lock.eventUnlocked')}</span>
                <span className="num text-[12.5px] text-muted">{when.format(new Date(e.createdAt))}</span>
                {e.actor && <span className="text-[12.5px] text-muted">· {e.actor.name}</span>}
              </div>
              <p className="text-[13px] mt-0.5">{lockReasonText(e.reason)}</p>
              {e.healthRecord && (
                <p className="text-[12.5px] text-muted mt-0.5">{t('lock.basedOnExam', { date: new Date(e.healthRecord.examDate).toLocaleDateString('vi-VN'), diagnosis: e.healthRecord.diagnosis })}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
