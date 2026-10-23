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

const HEALTH_STATUS_OPTIONS: { value: HealthStatus; label: string; desc: string }[] = [
  { value: 'FIT', label: 'Khỏe mạnh', desc: 'Ngựa đủ sức khỏe thi đấu và huấn luyện' },
  { value: 'MONITORING', label: 'Cần theo dõi', desc: 'Phát hiện dấu hiệu bất thường, cần giám sát thêm' },
  { value: 'INJURED', label: 'Chấn thương', desc: 'Ngựa bị chấn thương, hạn chế vận động' },
  { value: 'QUARANTINED', label: 'Cách ly', desc: 'Ngựa bị bệnh truyền nhiễm, cách ly hoàn toàn' },
];

export function CreateHealthRecordModal({ isOpen, onClose, onCreated, horseId, horseName }: Props) {
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
      <ModalHead icon="steth" title="Ghi nhận Hồ sơ Khám bệnh" id="create-health-record-title" onClose={handleClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <ErrorText err={err} />

          <Field label="Ngựa được khám">
            <Input value={horseName} disabled ro />
          </Field>

          <Field label="Ngày khám" hint="Không được chọn ngày tương lai">
            <Input type="date" value={examDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} required />
          </Field>

          <Field label="Chẩn đoán" hint="Mô tả chi tiết tình trạng sau khi khám (bắt buộc)">
            <Textarea
              value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} maxLength={2000}
              placeholder="VD: Ngựa có dấu hiệu viêm gân chân trước bên phải, sưng nhẹ vùng cổ chân..." required
            />
          </Field>

          <Field label="Phương pháp điều trị" hint="Phác đồ điều trị, đơn thuốc, chỉ định nghỉ ngơi...">
            <Textarea
              value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={3} maxLength={2000}
              placeholder="VD: Chườm đá 2 lần/ngày, nghỉ tập 7 ngày, thuốc chống viêm Phenylbutazone..."
            />
          </Field>

          <Field label="Cập nhật trạng thái sức khỏe" hint="Thay đổi trạng thái y tế của ngựa sau khám. Bỏ trống nếu không đổi.">
            <select
              className="h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15"
              value={healthStatus} onChange={(e) => setHealthStatus(e.target.value as HealthStatus | '')}
            >
              <option value="">— Không thay đổi trạng thái —</option>
              {HEALTH_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>

          {selectedStatus && (selectedStatus.value === 'INJURED' || selectedStatus.value === 'QUARANTINED') && (
            <Alert tone="bad" icon="alert" title={selectedStatus.value === 'QUARANTINED' ? 'Ngựa sẽ bị cách ly' : 'Ngựa sẽ được đánh dấu chấn thương'}>
              {selectedStatus.desc}.
              {selectedStatus.value === 'QUARANTINED' && ' Ngựa sẽ không thể lập giáo án hoặc tham gia giải đua cho đến khi được giải phóng.'}
              {selectedStatus.value === 'INJURED' && ' Nếu cần khóa huấn luyện, vui lòng sử dụng chức năng "Khóa tập" riêng biệt.'}
            </Alert>
          )}

          {selectedStatus && selectedStatus.value === 'FIT' && (
            <Alert tone="ok" icon="check">
              Ngựa sẽ được chuyển về trạng thái <strong>Khỏe mạnh</strong> — đủ điều kiện huấn luyện và thi đấu.
            </Alert>
          )}
        </ModalBody>

        <ModalFoot>
          <Btn onClick={handleClose} disabled={busy}>Hủy</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu hồ sơ khám'}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
