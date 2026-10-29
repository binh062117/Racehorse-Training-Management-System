import { Pagination } from '../../components/Pagination';
import { usePagedResource } from '../../lib/usePagedResource';
import {
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../../lib/api';
import type { HealthRecord, Horse } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { CreateHealthRecordModal } from '../../components/health/CreateHealthRecordModal';
import { TreatmentPlansSection } from '../../components/health/TreatmentPlansSection';
import { InjuryLocationsSection } from '../../components/health/InjuryLocationsSection';
import { AiInsightCard } from '../../components/horse/AiInsightCard';
import { formatDate } from '../../lib/format';
import { Btn, Card, EmptyState, Field, FileInput, HealthBadge, LockBadge, Icon, Textarea } from '../../ds/ui';

/* ========== Main component ========== */
export function HealthTab({ horse, onHorseChanged }: { horse: Horse; onHorseChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isVet = user?.role === 'VET';
  const canUseAi = user?.role === 'VET' || user?.role === 'MANAGER';

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const { data: records, total, loading, error: err, refresh: load } = usePagedResource<HealthRecord>('/horses/' + horse.id + '/health-records', page);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold">{t('healthRecordsPage.title', 'Hồ sơ khám bệnh')}</h2>
          <p className="text-[13px] text-muted mt-0.5">
            {loading ? t('ui.loading') : t('hai.recordCount', { count: total })}
          </p>
        </div>
        {isVet && (
          <Btn v="p" onClick={() => setModalOpen(true)}>
            <Icon name="plus" />{t('healthRecordsPage.newRecord', 'Ghi nhận hồ sơ khám')}
          </Btn>
        )}
      </div>

      {canUseAi && <AiInsightCard horseId={horse.id} />}
      <Card className="px-5 py-3.5 flex flex-wrap items-center gap-3">
        <span className="text-muted">{t('healthView.currentStatus')}</span>
        <HealthBadge status={horse.healthStatus} />
        {horse.locked && <LockBadge />}
      </Card>

      {loading ? (
        <p className="text-muted">{t('healthRecordsPage.loading', 'Đang tải hồ sơ…')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <EmptyState action={isVet ? <Btn sm v="p" onClick={() => setModalOpen(true)}>{t('healthRecordsPage.newRecord', 'Tạo hồ sơ khám đầu tiên')}</Btn> : undefined}>
          {t('health.empty', 'Chưa có hồ sơ y tế nào.')}
        </EmptyState>
      ) : (
        <ul className="list-none p-0 flex flex-col gap-3">
          {records.map((r) => <RecordItem key={r.id} record={r} isVet={isVet} onChanged={load} />)}
        </ul>
      )}

      <Pagination page={page} total={total} onPage={setPage} disabled={loading} />
      <CreateHealthRecordModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => { setPage(1); load(); void onHorseChanged(); }} horseId={horse.id} horseName={horse.name} />
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

  const download = () => {
    const url = getFileUrl(record.attachmentUrl);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <li>
      <Card className="p-5">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <div className="flex items-baseline gap-2.5">
            <strong className="num text-[15px]">{formatDate(record.examDate)}</strong>
            <span className="text-[13px] text-muted">{t('healthRecordsPage.colVet', 'Bác sĩ')} {record.vet.name}</span>
          </div>
          <div className="flex gap-1.5">
            {record.attachmentPath && <Btn sm onClick={download}>{t('health.openAttachment')}</Btn>}
            {isVet && !editing && <Btn sm onClick={() => setEditing(true)}>{t('common.update')}</Btn>}
          </div>
        </div>

        {/* Doctor-entered diagnosis is kept as-is */}
        <div className="mb-2">
          <span className="lbl">{t('health.diagnosis')}</span>
          <p className="mt-1 leading-relaxed">{record.diagnosis}</p>
        </div>

        {/* Doctor-entered treatment is kept as-is */}
        {record.treatment && (
          <div className="mb-2">
            <span className="lbl">{t('treatmentPlans.examinationNotes')}</span>
            <p className="mt-1 leading-relaxed">{record.treatment}</p>
          </div>
        )}

        {isVet && (
          <form onSubmit={upload} className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
            <FileInput ref={fileRef} type="file" aria-label={t('health.uploadAttachment')} accept=".jpg,.jpeg,.png,.webp,.pdf" className="flex-1 min-w-0" />
            <Btn sm type="submit" disabled={busy}>{t('health.uploadAttachment')}</Btn>
          </form>
        )}

        {editing && (
          <form onSubmit={save} className="flex flex-col gap-3 mt-3.5">
            <Field label={t('health.diagnosis')}><Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} /></Field>
            <Field label={t('treatmentPlans.examinationNotes')}><Textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={2} /></Field>
            <div className="flex gap-2">
              <Btn v="p" sm type="submit" disabled={busy}>{t('common.save')}</Btn>
              <Btn sm onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Btn>
            </div>
          </form>
        )}
        <ErrorText err={err} />

        <TreatmentPlansSection healthRecordId={record.id} isVet={isVet} />
        <InjuryLocationsSection basePath={`/health-records/${record.id}`} isVet={isVet} />
      </Card>
    </li>
  );
}
