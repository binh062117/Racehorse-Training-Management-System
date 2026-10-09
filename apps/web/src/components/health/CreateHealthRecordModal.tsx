import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { HealthRecord, HealthStatus } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Field } from '../Field';
import { AlertIcon } from '../Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (record: HealthRecord) => void;
  horseId: string;
  horseName: string;
}

const HEALTH_STATUS_OPTIONS: { value: HealthStatus; label: string; desc: string; css: string }[] = [
  { value: 'FIT', label: 'Khỏe mạnh', desc: 'Ngựa đủ sức khỏe thi đấu và huấn luyện', css: 'badge-success' },
  { value: 'MONITORING', label: 'Cần theo dõi', desc: 'Phát hiện dấu hiệu bất thường, cần giám sát thêm', css: 'badge-warning' },
  { value: 'INJURED', label: 'Chấn thương', desc: 'Ngựa bị chấn thương, hạn chế vận động', css: 'badge-danger' },
  { value: 'QUARANTINED', label: 'Cách ly', desc: 'Ngựa bị bệnh truyền nhiễm, cách ly hoàn toàn', css: 'badge-danger' },
];

export function CreateHealthRecordModal({
  isOpen,
  onClose,
  onCreated,
  horseId,
  horseName,
}: Props) {
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  if (!isOpen) return null;

  const selectedStatus = HEALTH_STATUS_OPTIONS.find((s) => s.value === healthStatus);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!examDate) {
      setErr(new Error('Vui lòng chọn ngày khám.'));
      return;
    }

    if (!diagnosis.trim()) {
      setErr(new Error('Vui lòng nhập chẩn đoán.'));
      return;
    }

    // Validate examDate is not in the future
    if (new Date(examDate) > new Date()) {
      setErr(new Error('Ngày khám không được ở tương lai.'));
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        examDate: new Date(examDate).toISOString(),
        diagnosis: diagnosis.trim(),
      };
      if (treatment.trim()) {
        body.treatment = treatment.trim();
      }
      if (healthStatus) {
        body.healthStatus = healthStatus;
      }

      const res = await api.post<HealthRecord>(
        `/horses/${horseId}/health-records`,
        body,
      );
      // Reset form
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
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 580 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Ghi nhận Hồ sơ Khám bệnh</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Đóng"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body stack" style={{ gap: 16 }}>
            <ErrorText err={err} />

            {/* Horse name (read-only) */}
            <Field label="Chiến mã khám">
              <input
                type="text"
                className="input"
                value={horseName}
                disabled
                style={{ background: 'var(--surface-subtle)', fontWeight: 600 }}
              />
            </Field>

            {/* Exam date */}
            <Field label="Ngày khám" hint="Không được chọn ngày tương lai">
              <input
                className="input"
                type="date"
                value={examDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExamDate(e.target.value)}
                required
              />
            </Field>

            {/* Diagnosis */}
            <Field label="Chẩn đoán" hint="Mô tả chi tiết tình trạng sau khi khám (bắt buộc)">
              <textarea
                className="input"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="VD: Ngựa có dấu hiệu viêm gân chân trước bên phải, sưng nhẹ vùng cổ chân..."
                required
              />
            </Field>

            {/* Treatment */}
            <Field label="Phương pháp điều trị" hint="Phác đồ điều trị, đơn thuốc, chỉ định nghỉ ngơi...">
              <textarea
                className="input"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="VD: Chườm đá 2 lần/ngày, nghỉ tập 7 ngày, thuốc chống viêm Phenylbutazone..."
              />
            </Field>

            {/* Health Status Update */}
            <Field
              label="Cập nhật trạng thái sức khỏe"
              hint="Thay đổi trạng thái y tế của ngựa sau khám. Bỏ trống nếu không đổi."
            >
              <select
                className="input"
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as HealthStatus | '')}
              >
                <option value="">— Không thay đổi trạng thái —</option>
                {HEALTH_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            {/* Status change warning */}
            {selectedStatus && (selectedStatus.value === 'INJURED' || selectedStatus.value === 'QUARANTINED') && (
              <div
                className="card"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--danger)',
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <AlertIcon style={{ flexShrink: 0, color: 'var(--danger)', marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--danger)' }}>
                    {selectedStatus.value === 'QUARANTINED'
                      ? 'Ngựa sẽ bị cách ly'
                      : 'Ngựa sẽ được đánh dấu chấn thương'}
                  </strong>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    {selectedStatus.desc}.
                    {selectedStatus.value === 'QUARANTINED' &&
                      ' Ngựa sẽ không thể lập giáo án hoặc tham gia giải đua cho đến khi được giải phóng.'}
                    {selectedStatus.value === 'INJURED' &&
                      ' Nếu cần khóa huấn luyện, vui lòng sử dụng chức năng "Khóa tập" riêng biệt.'}
                  </p>
                </div>
              </div>
            )}

            {selectedStatus && selectedStatus.value === 'FIT' && (
              <div
                className="card"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--success)',
                  padding: '12px 16px',
                }}
              >
                <p className="small" style={{ margin: 0, color: 'var(--success)' }}>
                  Ngựa sẽ được chuyển về trạng thái <strong>Khỏe mạnh</strong> — đủ điều kiện huấn luyện và thi đấu.
                </p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              onClick={handleClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
            >
              {busy ? 'Đang lưu...' : 'Lưu hồ sơ khám'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
