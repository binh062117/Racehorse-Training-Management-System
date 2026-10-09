import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { HealthRecord, HealthStatus, Horse, Paginated } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import { ErrorText } from '../../components/ErrorText';
import { CreateHealthRecordModal } from '../../components/health/CreateHealthRecordModal';
import { AiInsightCard } from '../../components/horse/AiInsightCard';
import { PlusIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';

/* ---------- Health status helpers ---------- */
const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  FIT: 'Khỏe mạnh',
  MONITORING: 'Cần theo dõi',
  INJURED: 'Chấn thương',
  QUARANTINED: 'Cách ly',
};

const HEALTH_STATUS_CSS: Record<HealthStatus, string> = {
  FIT: 'badge-success',
  MONITORING: 'badge-warning',
  INJURED: 'badge-danger',
  QUARANTINED: 'badge-danger',
};

/* ========== Main component ========== */
export function HealthTab({ horse }: { horse: Horse }) {
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
      const res = await api.get<Paginated<HealthRecord>>(
        `/horses/${horse.id}/health-records`,
        { params: { limit: 100 } },
      );
      setRecords(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      {/* Header toolbar */}
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>Hồ sơ khám bệnh</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {isVet
              ? 'Ghi nhận kết quả khám, chẩn đoán và cập nhật tình trạng sức khỏe.'
              : 'Lịch sử khám bệnh và chẩn đoán của chiến mã.'}
          </p>
        </div>
        {isVet && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            <PlusIcon style={{ marginRight: 6 }} />
            Ghi nhận hồ sơ khám
          </button>
        )}
      </div>

      {canUseAi && <AiInsightCard horseId={horse.id} />}

      {/* Current health summary card */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          padding: '14px 20px',
        }}
      >
        <div>
          <span className="muted small">Trạng thái sức khỏe hiện tại</span>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${HEALTH_STATUS_CSS[horse.healthStatus]}`}>
              {HEALTH_STATUS_LABEL[horse.healthStatus]}
            </span>
            {horse.locked && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>
                Khóa tập
              </span>
            )}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-default)', paddingLeft: 24 }}>
          <span className="muted small">Tổng số lần khám</span>
          <div style={{ fontWeight: 700, fontSize: 20, marginTop: 2 }}>
            {loading ? '...' : records.length}
          </div>
        </div>
        {records.length > 0 && (
          <div style={{ borderLeft: '1px solid var(--border-default)', paddingLeft: 24 }}>
            <span className="muted small">Lần khám gần nhất</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {formatDate(records[0].examDate)}
            </div>
          </div>
        )}
      </div>

      {/* Records list */}
      {loading ? (
        <p className="muted">Đang tải hồ sơ...</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="muted">{t('health.empty')}</p>
          {isVet && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => setModalOpen(true)}
            >
              Tạo hồ sơ khám đầu tiên
            </button>
          )}
        </div>
      ) : (
        <ul className="list" style={{ listStyle: 'none', padding: 0 }}>
          {records.map((r) => (
            <RecordItem
              key={r.id}
              record={r}
              isVet={isVet}
              onChanged={load}
            />
          ))}
        </ul>
      )}

      {/* Create modal */}
      <CreateHealthRecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          void load();
        }}
        horseId={horse.id}
        horseName={horse.name}
      />
    </div>
  );
}

/* ========== Record item component ========== */
function RecordItem({
  record,
  isVet,
  onChanged,
}: {
  record: HealthRecord;
  isVet: boolean;
  onChanged: () => void;
}) {
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
    if (treatment.trim() !== (record.treatment ?? ''))
      body.treatment = treatment.trim() || null;
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
      if (fileRef.current) fileRef.current.value = '';
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
      const res = await api.get(`/files/${record.attachmentPath}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e2) {
      setErr(e2);
    }
  };

  return (
    <li
      className="card"
      style={{ padding: '16px 20px', marginBottom: 12 }}
    >
      {/* Header row: date + vet name */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <strong style={{ fontSize: 15 }}>{formatDate(record.examDate)}</strong>
          <span className="muted small" style={{ marginLeft: 10 }}>
            Bác sĩ: {record.vet.name}
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {record.attachmentPath && (
            <button type="button" className="btn btn-sm" onClick={download}>
              {t('health.openAttachment')}
            </button>
          )}
          {isVet && !editing && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditing(true)}
            >
              {t('common.update')}
            </button>
          )}
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{ marginBottom: 8 }}>
        <span className="muted small" style={{ fontWeight: 600 }}>
          {t('health.diagnosis')}
        </span>
        <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>{record.diagnosis}</p>
      </div>

      {/* Treatment */}
      {record.treatment && (
        <div style={{ marginBottom: 8 }}>
          <span className="muted small" style={{ fontWeight: 600 }}>
            {t('health.treatment')}
          </span>
          <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>{record.treatment}</p>
        </div>
      )}

      {/* Attachment upload (VET only) */}
      {isVet && (
        <form className="row" style={{ gap: 8, marginTop: 10 }} onSubmit={upload}>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="input"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button type="submit" className="btn btn-sm" disabled={busy}>
            {t('health.uploadAttachment')}
          </button>
        </form>
      )}

      {/* Inline editing form (VET only) */}
      {editing && (
        <form className="form-grid" style={{ marginTop: 14 }} onSubmit={save}>
          <Field label={t('health.diagnosis')}>
            <textarea
              className="input"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </Field>
          <Field label={t('health.treatment')}>
            <textarea
              className="input"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {t('common.save')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
      <ErrorText err={err} />
    </li>
  );
}
