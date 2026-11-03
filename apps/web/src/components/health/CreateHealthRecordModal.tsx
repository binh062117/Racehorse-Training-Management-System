import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useState, type FormEvent } from 'react';
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

const HEALTH_STATUS_OPTIONS = (): { value: HealthStatus; label: string; desc: string }[] => [
  { value: 'FIT', label: i18n.t("ui.fit"), desc: i18n.t('mergeUi.fitDescription') },
  { value: 'MONITORING', label: i18n.t("horseFlow.health.MONITORING"), desc: i18n.t("ui.signsRequiringFurtherMonitoring") },
  { value: 'INJURED', label: i18n.t("horseFlow.health.INJURED"), desc: i18n.t("ui.theHorseIsInjuredAndMayNeedRestrictedActivity") },
  { value: 'QUARANTINED', label: i18n.t("horseFlow.health.QUARANTINED"), desc: i18n.t("ui.theHorseIsInMedicalQuarantine") },
];

export function CreateHealthRecordModal({ isOpen, onClose, onCreated, horseId, horseName }: Props) {
  useTranslation();
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const selectedStatus = HEALTH_STATUS_OPTIONS().find((s) => s.value === healthStatus);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!examDate) {
      setErr(new Error(i18n.t("ui.selectAnExaminationDate")));
      return;
    }
    if (!diagnosis.trim()) {
      setErr(new Error(i18n.t("ui.enterADiagnosis")));
      return;
    }
    // Validate examDate is not in the future
    if (new Date(examDate) > new Date()) {
      setErr(new Error(i18n.t("ui.theExaminationDateCannotBeInTheFuture")));
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
      <ModalHead icon="steth" title={i18n.t("ui.recordMedicalExamination")} id="create-health-record-title" onClose={handleClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <ErrorText err={err} />

          <Field label={i18n.t("mergeUi.examHorse")}>
            <Input value={horseName} disabled ro />
          </Field>

          <Field label={i18n.t("health.examDate")} hint={i18n.t("ui.futureDatesAreNotAllowed")}>
            <Input type="date" value={examDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} required />
          </Field>

          <Field label={i18n.t("health.diagnosis")} hint={i18n.t("ui.describeTheExaminationFindingsRequired")}>
            <Textarea
              value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} maxLength={2000}
              placeholder={i18n.t("ui.exampleMildSwellingAroundTheRightFrontTendon")} required
            />
          </Field>

          <Field label={i18n.t("ui.treatmentNotes")} hint={i18n.t("ui.examinationTreatmentNotesMedicationNotesOrRestInstructions")}>
            <Textarea
              value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={3} maxLength={2000}
              placeholder={i18n.t("ui.exampleColdTherapyTwiceDailyRestForSevenDays")}
            />
          </Field>

          <Field label={i18n.t("ui.updateHealthStatus")} hint={i18n.t("ui.updateTheHorseSHealthStatusAfterThisExaminationLeaveUnchangedIfNotAppl")}>
            <select
              className="h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15"
              value={healthStatus} onChange={(e) => setHealthStatus(e.target.value as HealthStatus | '')}
            >
              <option value="">{i18n.t("ui.keepCurrentStatus")}</option>
              {HEALTH_STATUS_OPTIONS().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>

          {selectedStatus && (selectedStatus.value === 'INJURED' || selectedStatus.value === 'QUARANTINED') && (
            <Alert tone="bad" icon="alert" title={selectedStatus.value === 'QUARANTINED' ? i18n.t("ui.theHorseWillBeMarkedAsQuarantined") : i18n.t("ui.theHorseWillBeMarkedAsInjured")}>
              {selectedStatus.desc}.
              {' '}{selectedStatus.value === 'QUARANTINED' && i18n.t('mergeUi.quarantineWarning')}
              {selectedStatus.value === 'INJURED' && i18n.t('mergeUi.injuryLockWarning')}
            </Alert>
          )}

          {selectedStatus && selectedStatus.value === 'FIT' && (
            <Alert tone="ok" icon="check">
              {i18n.t('mergeUi.fitWarning')}
            </Alert>
          )}
        </ModalBody>

        <ModalFoot>
          <Btn onClick={handleClose} disabled={busy}>{i18n.t("ui.cancel")}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? i18n.t("races.saving") : i18n.t("ui.saveExamination")}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
