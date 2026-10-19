import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Input, Modal, ModalBody, ModalFoot, ModalHead, Textarea } from '../../ds/ui';
import { createTreatmentPlan } from '../../lib/treatmentPlans';
import { ErrorText } from '../ErrorText';

export function CreateTreatmentPlanModal({ recordId, onClose, onCreated }: {
  recordId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const saving = useRef(false);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const close = () => { if (!saving.current) onClose(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    setErr(null);
    setValidation('');
    if (!description.trim()) { setValidation('descriptionRequired'); return; }
    if (!startDate || !Number.isFinite(Date.parse(startDate)) || (endDate && !Number.isFinite(Date.parse(endDate)))) {
      setValidation('invalidDates'); return;
    }
    if (endDate && endDate < startDate) { setValidation('dateOrder'); return; }
    saving.current = true;
    setBusy(true);
    try {
      await createTreatmentPlan(recordId, {
        description: description.trim(), startDate,
        ...(endDate ? { endDate } : {}),
      });
      onCreated();
    } catch (error) {
      setErr(error);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={close} labelledBy={`${id}-title`}>
      <ModalHead title={t('treatmentPlans.addPlan')} id={`${id}-title`} onClose={close} />
      <form onSubmit={submit}>
        <ModalBody>
          {validation && <p role="alert" className="text-bad">{t(`treatmentPlans.${validation}`)}</p>}
          <ErrorText err={err} />
          <Field label={t('treatmentPlans.description')} htmlFor={`${id}-description`} req>
            <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} required disabled={busy} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('treatmentPlans.startDate')} htmlFor={`${id}-start`} req>
              <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={busy} />
            </Field>
            <Field label={t('treatmentPlans.endDate')} htmlFor={`${id}-end`} hint={t('treatmentPlans.optional')}>
              <Input id={`${id}-end`} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy} />
            </Field>
          </div>
        </ModalBody>
        <ModalFoot>
          <Btn onClick={close} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{t(busy ? 'treatmentPlans.saving' : 'common.save')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
