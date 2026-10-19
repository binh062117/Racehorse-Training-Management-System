import i18n from '../../i18n';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { HealthRecord, Horse, Paginated } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { CreateHealthRecordModal } from '../../components/health/CreateHealthRecordModal';
import { HealthStatusBadge } from '../../components/health/HealthStatusBadge';
import { TreatmentPlansSection } from '../../components/health/TreatmentPlansSection';
import { AiInsightCard } from '../../components/horse/AiInsightCard';
import { formatDate } from '../../lib/format';
import { FileInput, Badge, Btn, Card, Field, Icon, Textarea } from '../../ds/ui';

/* ========== Main component ========== */
export function HealthTab({ horse, onHorseChanged }: { horse: Horse; onHorseChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isVet = user?.role === 'VET';
  const canUseAi = user?.role === 'VET' || user?.role === 'MANAGER';

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<HealthRecord>>(`/horses/${horse.id}/health-records`, { params: { limit: 100 } });
      setRecords(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold">{i18n.t("nav.healthRecords")}</h2>
          <p className="cap mt-0.5">
            {isVet ? i18n.t("ui.recordExaminationFindingsAndDiagnosesAndUpdateHealthStatus") : i18n.t("ui.examinationAndDiagnosisHistoryForThisHorse")}
          </p>
        </div>
        {isVet && <Btn v="p" onClick={() => setModalOpen(true)}><Icon name="plus" />{i18n.t("ui.recordExamination")}</Btn>}
      </div>

      {canUseAi && <AiInsightCard horseId={horse.id} />}

      <Card className="flex flex-wrap gap-6 items-center px-5 py-3.5">
        <div>
          <span className="cap">{t('healthView.currentStatus')}</span>
          <div className="mt-1">
            <HealthStatusBadge status={horse.healthStatus} />
            {horse.locked && <Badge tone="bad" className="ml-1.5">{t('horseStatusBadge.locked')}</Badge>}
          </div>
        </div>
        <div className="border-l border-line pl-6">
          <span className="cap">{i18n.t("ui.examinations")}</span>
          <div className="font-bold text-xl mt-0.5">{loading ? '...' : records.length}</div>
        </div>
        {records.length > 0 && (
          <div className="border-l border-line pl-6">
            <span className="cap">{i18n.t("ui.latestExamination")}</span>
            <div className="font-semibold mt-0.5">{formatDate(records[0].examDate)}</div>
          </div>
        )}
      </Card>

      {loading ? (
        <p className="cap">{i18n.t("horseFlow.loading")}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="cap">{t('health.empty')}</p>
          {isVet && <Btn v="p" className="mt-3" onClick={() => setModalOpen(true)}>{i18n.t("ui.createTheFirstExamination")}</Btn>}
        </Card>
      ) : (
        <ul className="list-none p-0 flex flex-col gap-3">
          {records.map((r) => <RecordItem key={r.id} record={r} isVet={isVet} onChanged={load} />)}
        </ul>
      )}

      <CreateHealthRecordModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => { void load(); void onHorseChanged(); }} horseId={horse.id} horseName={horse.name} />
    </div>
  );
}

/* ========== Record item component ========== */
function RecordItem({ record, isVet, onChanged }: { record: HealthRecord; isVet: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(record.diagnosis);
  const [treatment, setTreatment] = useState(record.treatment ?? '');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (diagnosis.trim() !== record.diagnosis) body.diagnosis = diagnosis.trim();
    if (treatment.trim() !== (record.treatment ?? '')) body.treatment = treatment.trim() || null;
    try {
      await api.patch(`/health-records/${record.id}`, body);
      setEditing(false);
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/health-records/${record.id}/attachment`, form);
      if (fileRef.current) {
        fileRef.current.value = '';
        fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!record.attachmentPath) return;
    setErr(null);
    try {
      const res = await api.get(`/files/${record.attachmentPath}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e2) {
      setErr(e2);
    }
  };

  return (
    <li>
      <Card className="p-5">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <strong className="text-[15px]">{formatDate(record.examDate)}</strong>
            <span className="cap ml-2.5">{i18n.t("ui.vet2")}{' '}{record.vet.name}</span>
          </div>
          <div className="flex gap-1.5">
            {record.attachmentPath && <Btn sm onClick={() => void download()}>{t('health.openAttachment')}</Btn>}
            {isVet && !editing && <Btn sm onClick={() => setEditing(true)}>{t('common.update')}</Btn>}
          </div>
        </div>

        <div className="mb-2">
          <span className="lbl">{t('health.diagnosis')}</span>
          <p className="mt-1 leading-relaxed">{record.diagnosis}</p>
        </div>

        {record.treatment && (
          <div className="mb-2">
            <span className="lbl">{t('treatmentPlans.examinationNotes')}</span>
            <p className="mt-1 leading-relaxed">{record.treatment}</p>
          </div>
        )}

        {isVet && (
          <form onSubmit={upload} className="flex flex-wrap gap-2 mt-2.5">
            <FileInput ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="flex-1 text-[12.5px]" />
            <Btn sm type="submit" disabled={busy}>{t('health.uploadAttachment')}</Btn>
          </form>
        )}

        {editing && (
          <form onSubmit={save} className="flex flex-col gap-3 mt-3.5">
            <Field label={t('health.diagnosis')}><Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} /></Field>
            <Field label={t('health.treatment')}><Textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={2} /></Field>
            <div className="flex gap-2">
              <Btn v="p" sm type="submit" disabled={busy}>{t('common.save')}</Btn>
              <Btn sm onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Btn>
            </div>
          </form>
        )}
        <ErrorText err={err} />
        <TreatmentPlansSection recordId={record.id} />
      </Card>
    </li>
  );
}
