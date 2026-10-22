import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { HealthRecord, HealthStatus } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Alert, Btn, Field, Input, Modal, ModalBody, ModalFoot, ModalHead, Textarea } from '../../ds/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (record: HealthRecord) => void;
  horseId: string;
  horseName: string;
}

const HEALTH_STATUS_OPTIONS: { value: HealthStatus }[] = [
  { value: 'FIT' },
  { value: 'MONITORING' },
  { value: 'INJURED' },
  { value: 'QUARANTINED' },
];

export function CreateHealthRecordModal({ isOpen, onClose, onCreated, horseId, horseName }: Props) {
  const { t } = useTranslation();
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const selectedStatus = HEALTH_STATUS_OPTIONS.find((s) => s.value === healthStatus);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!examDate) {
      setErr(new Error(t('healthRecordModal.dateRequired')));
      return;
    }
    if (!diagnosis.trim()) {
      setErr(new Error(t('healthRecordModal.diagnosisRequired')));
      return;
    }
    // Validate examDate is not in the future
    if (new Date(examDate) > new Date()) {
      setErr(new Error(t('healthRecordModal.dateInFuture')));
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        examDate: new Date(examDate).toISOString(),
        diagnosis: diagnosis.trim(),
      };
      if (treatment.trim()) body.treatment = treatment.trim();
      if (healthStatus) body.healthStatus = healthStatus;

      const res = await api.post<HealthRecord>(`/horses/${horseId}/health-records`, body);
      setExamDate(new Date().toISOString().slice(0, 10));
      setDiagnosis('');
      setTreatment('');
      setHealthStatus('');
      onCreated(res.data);
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (!busy) {
      setErr(null);
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} width={580} labelledBy="create-health-record-title">
      <ModalHead icon="steth" title={t('healthRecordModal.title')} id="create-health-record-title" onClose={handleClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <ErrorText err={err} />

          <Field label={t('healthRecordModal.horse')}>
            <Input value={horseName} disabled ro />
          </Field>

          <Field label={t('healthRecordModal.examDate')} hint={t('healthRecordModal.futureDateHint')}>
            <Input type="date" value={examDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} required />
          </Field>

          <Field label={t('healthRecordModal.diagnosis')} hint={t('healthRecordModal.diagnosisHint')}>
            <Textarea
              value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} maxLength={2000}
              placeholder={t('healthRecordModal.diagnosisPlaceholder')} required
            />
          </Field>

          <Field label={t('healthRecordModal.treatment')} hint={t('healthRecordModal.treatmentHint')}>
            <Textarea
              value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={3} maxLength={2000}
              placeholder={t('healthRecordModal.treatmentPlaceholder')}
            />
          </Field>

          <Field label={t('healthRecordModal.updateStatus')} hint={t('healthRecordModal.statusHint')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={healthStatus} onChange={(e) => setHealthStatus(e.target.value as HealthStatus | '')}
            >
              <option value="">{t('healthRecordModal.unchanged')}</option>
              {HEALTH_STATUS_OPTIONS.map(({ value }) => <option key={value} value={value}>{t(`horseStatusBadge.${value}`)}</option>)}
            </select>
          </Field>

          {selectedStatus && (selectedStatus.value === 'INJURED' || selectedStatus.value === 'QUARANTINED') && (
            <Alert tone="bad" icon="alert" title={t(selectedStatus.value === 'QUARANTINED' ? 'healthRecordModal.quarantineTitle' : 'healthRecordModal.injuredTitle')}>
              {selectedStatus.value === 'QUARANTINED' ? t('healthRecordModal.quarantineMessage') : t('healthRecordModal.injuredMessage')}
            </Alert>
          )}

          {selectedStatus && selectedStatus.value === 'FIT' && (
            <Alert tone="ok" icon="check">
              {t('healthRecordModal.fitMessage')}
            </Alert>
          )}
        </ModalBody>

        <ModalFoot>
          <Btn onClick={handleClose} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? t('healthRecordModal.saving') : t('healthRecordModal.save')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
