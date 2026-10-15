import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Alert, Btn, Chip, Field, Input, Modal, ModalBody, ModalFoot, ModalHead, Textarea } from '../../ds/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plan: TrainingPlan) => void;
  defaultHorseId?: string;
  defaultHorseName?: string;
}

const GOAL_TEMPLATES = [
  'Xây dựng nền tảng thể lực, cự ly 1400m sân cát (Khối lượng vừa)',
  'Tăng cường sức bền cự ly 1600m mặt cỏ tự nhiên (Khối lượng cao)',
  'Rèn luyện bứt tốc nước rút cự ly 1200m chuẩn bị giải đấu',
  'Bài tập nhẹ phục hồi thể trạng & theo dõi gân cơ',
];

export function CreateTrainingPlanModal({ isOpen, onClose, onCreated, defaultHorseId, defaultHorseName }: Props) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState(defaultHorseId ?? '');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
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
          const eligible = all.filter((h) => h.status !== 'RETIRED' && h.healthStatus !== 'QUARANTINED');
          setHorses(eligible);
          if (eligible.length > 0) setHorseId(eligible[0].id);
        })
        .catch((e) => setErr(e))
        .finally(() => setLoadingHorses(false));
    }
  }, [isOpen, defaultHorseId]);

  const selectedHorse = defaultHorseId ? null : horses.find((h) => h.id === horseId);

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
      const res = await api.post<TrainingPlan>(`/horses/${targetHorseId}/training-plans`, {
        goal: goal.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      onCreated(res.data);
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const selectCls = 'h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info';

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} width={560} labelledBy="create-plan-title">
      <ModalHead icon="plans" title="Lập Giáo án Huấn luyện" id="create-plan-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <ErrorText err={err} />

          {defaultHorseId ? (
            <Field label="Chiến mã áp dụng">
              <Input value={defaultHorseName ?? defaultHorseId} disabled ro />
            </Field>
          ) : (
            <Field label="Chọn chiến mã" hint="Ngựa đã giải nghệ (RETIRED) hoặc đang cách ly (QUARANTINED) không xuất hiện trong danh sách.">
              {loadingHorses ? (
                <p className="cap">Đang tải danh sách ngựa…</p>
              ) : (
                <select className={selectCls} value={horseId} onChange={(e) => setHorseId(e.target.value)} required>
                  {horses.length === 0 && <option value="">— Không có ngựa đủ điều kiện —</option>}
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

          {(selectedHorse?.locked || selectedHorse?.healthStatus === 'INJURED') && (
            <Alert tone="warn" icon="alert" title="Lưu ý">
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
            </Alert>
          )}

          <Field label="Mục tiêu huấn luyện" hint="Cự ly, khối lượng, mặt sân hoặc giai đoạn chuẩn bị giải đấu (tối đa 500 ký tự)">
            <Textarea
              rows={3} value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="Ví dụ: Rèn luyện sức bền cự ly 1600m mặt sân cỏ, tăng cường bứt tốc giai đoạn cuối chuẩn bị Spring Derby..."
              required maxLength={500}
            />
            <div className="mt-2">
              <div className="cap mb-1.5">Gợi ý giáo án chuẩn (bấm để áp dụng nhanh):</div>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_TEMPLATES.map((tpl) => (
                  <Chip key={tpl} onClick={() => setGoal(tpl)} className="h-auto py-1 text-[11.5px]">+ {tpl}</Chip>
                ))}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Ngày bắt đầu">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label="Ngày kết thúc (tùy chọn)">
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </ModalBody>

        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>Hủy</Btn>
          <Btn v="p" type="submit" disabled={busy || loadingHorses}>{busy ? 'Đang tạo…' : 'Tạo giáo án'}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
