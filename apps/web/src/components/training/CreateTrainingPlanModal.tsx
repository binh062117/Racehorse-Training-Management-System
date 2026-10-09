import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Field } from '../Field';
import { AlertIcon } from '../Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plan: TrainingPlan) => void;
  defaultHorseId?: string;
  defaultHorseName?: string;
}

export function CreateTrainingPlanModal({
  isOpen,
  onClose,
  onCreated,
  defaultHorseId,
  defaultHorseName,
}: Props) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState(defaultHorseId ?? '');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState('');

  const [loadingHorses, setLoadingHorses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErr(null);
    setGoal('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');

    if (defaultHorseId) {
      setHorseId(defaultHorseId);
    } else {
      setHorseId('');
      setLoadingHorses(true);
      api
        .get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
        .then((res) => {
          const all = res.data.data ?? [];
          // BR: exclude RETIRED and QUARANTINED — backend will reject anyway
          const eligible = all.filter(
            (h) => h.status !== 'RETIRED' && h.healthStatus !== 'QUARANTINED',
          );
          setHorses(eligible);
          if (eligible.length > 0) {
            setHorseId(eligible[0].id);
          }
        })
        .catch((e) => setErr(e))
        .finally(() => setLoadingHorses(false));
    }
  }, [isOpen, defaultHorseId]);

  if (!isOpen) return null;

  const selectedHorse = defaultHorseId
    ? null
    : horses.find((h) => h.id === horseId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const targetHorseId = defaultHorseId ?? horseId;
    if (!targetHorseId) {
      setErr(new Error('Vui lòng chọn chiến mã để lập giáo án.'));
      return;
    }

    if (!goal.trim()) {
      setErr(new Error('Vui lòng nhập mục tiêu huấn luyện.'));
      return;
    }

    if (!startDate) {
      setErr(new Error('Vui lòng chọn ngày bắt đầu.'));
      return;
    }

    if (endDate && endDate < startDate) {
      setErr(new Error('Ngày kết thúc không được trước ngày bắt đầu.'));
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<TrainingPlan>(
        `/horses/${targetHorseId}/training-plans`,
        {
          goal: goal.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        },
      );
      onCreated(res.data);
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Lập Giáo án Huấn luyện</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body stack" style={{ gap: 16 }}>
            <ErrorText err={err} />

            {/* Horse Selection */}
            {defaultHorseId ? (
              <Field label="Chiến mã áp dụng">
                <input
                  type="text"
                  value={defaultHorseName ?? defaultHorseId}
                  disabled
                  style={{ background: 'var(--surface-subtle)', fontWeight: 600 }}
                />
              </Field>
            ) : (
              <Field
                label="Chọn chiến mã"
                hint="Ngựa đã giải nghệ (RETIRED) hoặc đang cách ly (QUARANTINED) không xuất hiện trong danh sách."
              >
                {loadingHorses ? (
                  <p className="muted small">Đang tải danh sách ngựa…</p>
                ) : (
                  <select
                    value={horseId}
                    onChange={(e) => setHorseId(e.target.value)}
                    required
                  >
                    {horses.length === 0 && (
                      <option value="">— Không có ngựa đủ điều kiện —</option>
                    )}
                    {horses.map((h) => {
                      const tags: string[] = [];
                      if (h.status === 'RESTING') tags.push('Nghỉ dưỡng');
                      if (h.healthStatus === 'INJURED') tags.push('Chấn thương');
                      if (h.healthStatus === 'MONITORING') tags.push('Theo dõi');
                      if (h.locked) tags.push('KHÓA TẬP');
                      const suffix = tags.length > 0 ? ` [${tags.join(' · ')}]` : '';
                      return (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.breed ? `(${h.breed})` : ''} — Chủ: {h.owner.name}{suffix}
                        </option>
                      );
                    })}
                  </select>
                )}
              </Field>
            )}

            {/* Warning if horse is locked or injured */}
            {(selectedHorse?.locked || selectedHorse?.healthStatus === 'INJURED') && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'var(--status-warning-bg)',
                  border: '1px solid #e3cd8c',
                  borderRadius: 6,
                  fontSize: 12.5,
                  color: 'var(--status-warning)',
                }}
              >
                <AlertIcon width="16" height="16" />
                <div>
                  <strong>Lưu ý:</strong>{' '}
                  {selectedHorse.locked && (
                    <>
                      Ngựa này đang bị bác sĩ thú y khóa huấn luyện
                      {selectedHorse.lockReason ? ` (${selectedHorse.lockReason})` : ''}.
                      Bạn vẫn có thể soạn trước kế hoạch, nhưng không thể lên lịch buổi tập cho đến khi được mở khóa.
                    </>
                  )}
                  {!selectedHorse.locked && selectedHorse.healthStatus === 'INJURED' && (
                    <>
                      Ngựa đang trong trạng thái chấn thương (INJURED).
                      Giáo án sẽ được lưu nhưng nên phối hợp với bác sĩ thú y trước khi lên lịch buổi tập thực tế.
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Goal Input */}
            <Field
              label="Mục tiêu huấn luyện"
              hint="Cự ly, khối lượng, mặt sân hoặc giai đoạn chuẩn bị giải đấu (tối đa 500 ký tự)"
            >
              <textarea
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ví dụ: Rèn luyện sức bền cự ly 1600m mặt sân cỏ, tăng cường bứt tốc giai đoạn cuối chuẩn bị Spring Derby..."
                required
                maxLength={500}
              />
              <div style={{ marginTop: 8 }}>
                <div className="muted small" style={{ marginBottom: 6, fontWeight: 500 }}>
                  Gợi ý giáo án chuẩn (bấm để áp dụng nhanh):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    'Xây dựng nền tảng thể lực, cự ly 1400m sân cát (Khối lượng vừa)',
                    'Tăng cường sức bền cự ly 1600m mặt cỏ tự nhiên (Khối lượng cao)',
                    'Rèn luyện bứt tốc nước rút cự ly 1200m chuẩn bị giải đấu',
                    'Bài tập nhẹ phục hồi thể trạng & theo dõi gân cơ',
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      className="chip"
                      style={{ fontSize: '11.5px', padding: '3px 8px' }}
                      onClick={() => setGoal(tpl)}
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>
            </Field>

            {/* Date Range Inputs */}
            <div className="form-grid-2">
              <Field label="Ngày bắt đầu">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </Field>

              <Field label="Ngày kết thúc (tùy chọn)">
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || loadingHorses}
            >
              {busy ? 'Đang tạo…' : 'Tạo giáo án'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
