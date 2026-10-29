import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, FitnessAssessmentItem } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { ErrorText } from '../ErrorText';
import {
  Badge,
  Btn,
  Field,
  Icon,
  Modal,
  ModalBody,
  ModalFoot,
  ModalHead,
  Ring,
  Textarea,
  fitColor,
} from '../../ds/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  horse: Horse;
  onUpdated: () => void;
}

export function FitnessAssessmentModal({ isOpen, onClose, horse, onUpdated }: Props) {
  const { i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');

  const [tab, setTab] = useState<'form' | 'history'>('form');

  // 5 Criteria (0 - 20 each)
  const [speed, setSpeed] = useState(16);
  const [stamina, setStamina] = useState(15);
  const [condition, setCondition] = useState(16);
  const [recovery, setRecovery] = useState(15);
  const [morale, setMorale] = useState(16);
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const [history, setHistory] = useState<FitnessAssessmentItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const total = Math.min(100, Math.max(0, speed + stamina + condition + recovery + morale));

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    setTab('form');
    // Pre-fill with reasonable defaults based on existing fitnessScore if available
    if (horse.fitnessScore != null) {
      const avg = Math.round(horse.fitnessScore / 5);
      setSpeed(avg);
      setStamina(avg);
      setCondition(avg);
      setRecovery(avg);
      setMorale(avg);
    }

    setLoadingHistory(true);
    api
      .get<FitnessAssessmentItem[]>(`/horses/${horse.id}/fitness-assessments`)
      .then((res) => setHistory(res.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [isOpen, horse.id, horse.fitnessScore]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      await api.post(`/horses/${horse.id}/fitness-assessment`, {
        speedScore: speed,
        staminaScore: stamina,
        conditionScore: condition,
        recoveryScore: recovery,
        moraleScore: morale,
        notes: notes.trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const criteria = [
    {
      id: 'speed',
      label: isVi ? 'Tốc độ & Nước rút' : 'Speed & Sprint',
      desc: isVi ? 'Khả năng bứt phá tốc độ đoạn nước rút và vận tốc tối đa' : 'Acceleration and peak velocity',
      value: speed,
      setter: setSpeed,
      icon: 'sparkle',
    },
    {
      id: 'stamina',
      label: isVi ? 'Sức bền & Cự ly' : 'Stamina & Endurance',
      desc: isVi ? 'Duy trì nhịp chạy ổn định trên các cự ly trung bình và dài' : 'Ability to sustain pace over middle/long distances',
      value: stamina,
      setter: setStamina,
      icon: 'flag',
    },
    {
      id: 'condition',
      label: isVi ? 'Cơ gân & Hệ xương khớp' : 'Condition & Joint Health',
      desc: isVi ? 'Độ săn chắc cơ bắp, độ đàn hồi của gân gót, không đau nhức' : 'Muscular tone, tendon elasticity, absence of soreness',
      value: condition,
      setter: setCondition,
      icon: 'heart',
    },
    {
      id: 'recovery',
      label: isVi ? 'Khả năng phục hồi' : 'Recovery Rate',
      desc: isVi ? 'Tốc độ hạ nhịp tim, nhịp thở và bù nước sau buổi tập' : 'Heart rate and respiration recovery post-exercise',
      value: recovery,
      setter: setRecovery,
      icon: 'clock',
    },
    {
      id: 'morale',
      label: isVi ? 'Tinh thần & Ý chí thi đấu' : 'Morale & Willingness',
      desc: isVi ? 'Sự hăng hái, tập trung và tuân thủ hiệu lệnh của nài ngựa' : 'Focus, responsiveness to jockey aids, fighting spirit',
      value: morale,
      setter: setMorale,
      icon: 'dashboard',
    },
  ];

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} width={620} labelledBy="fitness-modal-title">
      <ModalHead
        icon="heart"
        title={isVi ? `Đánh giá Thể lực — ${horse.name}` : `Fitness Assessment — ${horse.name}`}
        id="fitness-modal-title"
        onClose={() => !busy && onClose()}
      />

      <ModalBody>
        <ErrorText err={err} />

        {/* Tab switcher */}
        <div className="flex border-b border-line mb-4 -mt-2">
          <button
            type="button"
            onClick={() => setTab('form')}
            className={`pb-2.5 px-3 text-[13.5px] font-medium border-b-2 transition-colors ${
              tab === 'form'
                ? 'border-info text-info font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {isVi ? 'Phiếu chấm điểm thể lực' : 'Assessment Form'}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`pb-2.5 px-3 text-[13.5px] font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              tab === 'history'
                ? 'border-info text-info font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <span>{isVi ? 'Lịch sử đánh giá' : 'Assessment History'}</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-badge bg-subtle text-muted">
              {history.length}
            </span>
          </button>
        </div>

        {tab === 'form' ? (
          <form onSubmit={handleSubmit} id="fitness-assessment-form">
            {/* Live Score Summary Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-card bg-subtle border border-line mb-5">
              <div className="flex items-center gap-3.5">
                <Ring
                  value={total}
                  size={52}
                  stroke={5}
                  color={fitColor(total)}
                  text={String(total)}
                  label="Điểm thể lực tổng"
                />
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                    {isVi ? 'Điểm thể lực tổng thể' : 'Total Fitness Score'}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[18px] font-bold num" style={{ color: fitColor(total) }}>
                      {total} / 100
                    </span>
                    <Badge
                      tone={total >= 80 ? 'ok' : total >= 60 ? 'warn' : 'bad'}
                      className="text-[11.5px]"
                    >
                      {total >= 80
                        ? (isVi ? 'Xuất sắc / Sẵn sàng' : 'Excellent')
                        : total >= 60
                          ? (isVi ? 'Đạt chuẩn / Khá' : 'Good')
                          : (isVi ? 'Yếu / Cần hồi phục' : 'Needs Rest')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="text-right text-[12px] text-muted hidden sm:block">
                <div>{isVi ? 'Tự động tính từ 5 tiêu chí' : 'Calculated from 5 criteria'}</div>
                <div className="font-medium text-ink mt-0.5">{isVi ? 'Thang điểm: 0 - 20 / tiêu chí' : 'Scale: 0 - 20 each'}</div>
              </div>
            </div>

            {/* Criteria sliders */}
            <div className="space-y-4">
              {criteria.map((c) => (
                <div key={c.id} className="p-3 rounded-card border border-line-soft bg-white hover:border-line transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[13.5px] text-ink">
                      <Icon name={c.icon} className="w-3.5 h-3.5 text-info" />
                      <span>{c.label}</span>
                    </div>
                    <span className="num font-bold text-[14px] px-2 py-0.5 rounded bg-subtle border border-line-soft text-ink min-w-[42px] text-center">
                      {c.value} <span className="text-muted text-[11px]">/ 20</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-muted mb-2.5">{c.desc}</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={c.value}
                      onChange={(e) => c.setter(Number(e.target.value))}
                      className="w-full accent-info cursor-pointer h-2 bg-line rounded-lg"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <Field
                label={isVi ? 'Ghi chú & Khuyến nghị của Bác sĩ / HLV' : 'Evaluator Notes & Recommendations'}
                hint={isVi ? 'Ghi rõ tình trạng sức khỏe cụ thể hoặc lưu ý cho giáo án tiếp theo.' : 'Specific conditions or adjustments for upcoming training plans.'}
              >
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isVi ? 'Ví dụ: Thể lực hồi phục tốt sau 1 tuần nghỉ, có thể tăng cự ly lên 1400m từ tuần sau...' : 'e.g. Good recovery, cleared for longer distances next week...'}
                  maxLength={1000}
                />
              </Field>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {loadingHistory ? (
              <p className="text-muted text-[13px] py-4 text-center">
                {isVi ? 'Đang tải lịch sử đánh giá thể lực…' : 'Loading assessment history…'}
              </p>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-muted text-[13.5px]">
                {isVi ? 'Chưa có bản ghi đánh giá thể lực nào cho ngựa này.' : 'No fitness assessment records found.'}
              </div>
            ) : (
              <div className="divide-y divide-line-soft max-h-[420px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="num font-bold text-[15px]" style={{ color: fitColor(item.totalScore) }}>
                          {item.totalScore}/100
                        </span>
                        <Badge tone={item.totalScore >= 80 ? 'ok' : item.totalScore >= 60 ? 'warn' : 'bad'}>
                          {item.totalScore >= 80
                            ? (isVi ? 'Rất tốt' : 'Excellent')
                            : item.totalScore >= 60
                              ? (isVi ? 'Khá' : 'Good')
                              : (isVi ? 'Yếu' : 'Weak')}
                        </Badge>
                        <span className="text-[12.5px] font-medium text-ink">
                          {item.assessedBy ? `${item.assessedBy.name} (${item.assessedBy.role})` : '—'}
                        </span>
                      </div>
                      <span className="text-[12px] text-muted">{formatDate(item.createdAt)}</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[11.5px] my-2 bg-subtle/50 p-2 rounded-card border border-line-soft">
                      <div>
                        <div className="text-muted">{isVi ? 'Tốc độ' : 'Speed'}</div>
                        <div className="num font-semibold mt-0.5">{item.speedScore}/20</div>
                      </div>
                      <div>
                        <div className="text-muted">{isVi ? 'Sức bền' : 'Stamina'}</div>
                        <div className="num font-semibold mt-0.5">{item.staminaScore}/20</div>
                      </div>
                      <div>
                        <div className="text-muted">{isVi ? 'Cơ gân' : 'Joint'}</div>
                        <div className="num font-semibold mt-0.5">{item.conditionScore}/20</div>
                      </div>
                      <div>
                        <div className="text-muted">{isVi ? 'Hồi phục' : 'Recovery'}</div>
                        <div className="num font-semibold mt-0.5">{item.recoveryScore}/20</div>
                      </div>
                      <div>
                        <div className="text-muted">{isVi ? 'Tinh thần' : 'Morale'}</div>
                        <div className="num font-semibold mt-0.5">{item.moraleScore}/20</div>
                      </div>
                    </div>

                    {item.notes && (
                      <p className="text-[12.5px] text-ink bg-white p-2 rounded border border-line-soft mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFoot>
        <Btn onClick={onClose} disabled={busy}>
          {isVi ? 'Đóng' : 'Close'}
        </Btn>
        {tab === 'form' && (
          <Btn v="p" type="submit" form="fitness-assessment-form" disabled={busy}>
            {busy ? (isVi ? 'Đang lưu…' : 'Saving…') : (isVi ? 'Lưu kết quả chấm điểm' : 'Save Assessment')}
          </Btn>
        )}
      </ModalFoot>
    </Modal>
  );
}
