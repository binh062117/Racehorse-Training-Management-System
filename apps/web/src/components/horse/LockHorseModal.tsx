import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, LockHistoryItem } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { ErrorText } from '../ErrorText';
import {
  Alert,
  Badge,
  Btn,
  Chip,
  Field,
  Icon,
  Modal,
  ModalBody,
  ModalFoot,
  ModalHead,
  Textarea,
} from '../../ds/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  horse: Horse;
  onUpdated: () => void;
}

const COMMON_LOCK_REASONS = [
  'Chấn thương cơ / khớp sau giải đua',
  'Sốt / mệt mỏi, cần theo dõi sức khỏe',
  'Nghỉ ngơi định kỳ theo phác đồ thú y',
  'Cách ly do nghi ngờ viêm da / nhiễm khuẩn',
  'Kiểm tra định kỳ thể trạng trước giải đấu',
];

const COMMON_UNLOCK_REASONS = [
  'Đã hồi phục hoàn toàn sau điều trị',
  'Kiểm tra y tế đạt chuẩn, cho phép tập nhẹ',
  'Hết thời gian cách ly theo dõi y tế',
  'Bác sĩ thú y xác nhận sẵn sàng trở lại tập luyện',
];

export function LockHorseModal({ isOpen, onClose, horse, onUpdated }: Props) {
  const { i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');

  const willLock = !horse.locked;
  const [tab, setTab] = useState<'action' | 'history'>('action');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const [history, setHistory] = useState<LockHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load history whenever modal opens or when action succeeds
  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setErr(null);
    setTab('action');

    setLoadingHistory(true);
    api
      .get<LockHistoryItem[]>(`/horses/${horse.id}/lock-history`)
      .then((res) => setHistory(res.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [isOpen, horse.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const trimmed = reason.trim();
    if (willLock && (!trimmed || trimmed.length < 5)) {
      setErr(new Error(isVi ? 'Vui lòng nhập lý do khóa tập luyện (tối thiểu 5 ký tự).' : 'Please provide a lock reason (at least 5 characters).'));
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/horses/${horse.id}/lock`, {
        locked: willLock,
        reason: trimmed || (willLock ? 'Khóa tập luyện' : 'Mở khóa tập luyện'),
      });
      onUpdated();
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = willLock
    ? (isVi ? `Khóa tập luyện — ${horse.name}` : `Lock Training — ${horse.name}`)
    : (isVi ? `Mở khóa tập luyện — ${horse.name}` : `Unlock Training — ${horse.name}`);

  const quickTemplates = willLock ? COMMON_LOCK_REASONS : COMMON_UNLOCK_REASONS;

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} width={560} labelledBy="lock-modal-title">
      <ModalHead
        icon={willLock ? 'lock' : 'unlock'}
        title={modalTitle}
        id="lock-modal-title"
        onClose={() => !busy && onClose()}
      />

      <ModalBody>
        <ErrorText err={err} />

        {/* Tab switcher: Thao tác vs Lịch sử */}
        <div className="flex border-b border-line mb-4 -mt-2">
          <button
            type="button"
            onClick={() => setTab('action')}
            className={`pb-2.5 px-3 text-[13.5px] font-medium border-b-2 transition-colors ${
              tab === 'action'
                ? 'border-info text-info font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {willLock ? (isVi ? 'Thao tác khóa tập' : 'Lock Action') : (isVi ? 'Thao tác mở khóa' : 'Unlock Action')}
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
            <span>{isVi ? 'Lịch sử khóa / mở' : 'Lock/Unlock History'}</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-badge bg-subtle text-muted">
              {history.length}
            </span>
          </button>
        </div>

        {tab === 'action' ? (
          <form onSubmit={handleSubmit} id="lock-horse-form">
            {willLock ? (
              <Alert tone="bad" icon="alert" title={isVi ? 'Lưu ý khi khóa tập luyện' : 'Important Note'}>
                {isVi
                  ? 'Khi khóa tập, ngựa sẽ bị cấm lên lịch buổi tập mới và không thể tạo giáo án huấn luyện mới cho đến khi được Bác sĩ thú y mở khóa.'
                  : 'When locked, this horse cannot be scheduled for new training sessions or plans until unlocked by a veterinarian.'}
              </Alert>
            ) : (
              <Alert tone="ok" icon="info" title={isVi ? 'Xác nhận mở khóa' : 'Unlock Confirmation'}>
                {isVi
                  ? `Ngựa đang bị khóa: "${horse.lockReason || 'Không có lý do'}". Sau khi mở khóa, ngựa có thể trở lại tập luyện bình thường.`
                  : `Currently locked: "${horse.lockReason || 'No reason'}". Once unlocked, the horse can resume training.`}
              </Alert>
            )}

            <div className="mt-4">
              <Field
                label={
                  willLock
                    ? (isVi ? 'Lý do khóa tập luyện (Bắt buộc)' : 'Reason for lock (Required)')
                    : (isVi ? 'Ghi chú mở khóa tập luyện (Khuyến khích)' : 'Unlock note (Recommended)')
                }
                hint={willLock ? (isVi ? 'Nhập rõ nguyên nhân để HLV và Quản lý nắm thông tin (tối thiểu 5 ký tự).' : 'Provide a clear reason for trainers and managers.') : undefined}
              >
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    willLock
                      ? (isVi ? 'Ví dụ: Đau gân cổ chân sau sau bài tập nặng, cần nghỉ dưỡng 10 ngày...' : 'e.g. Tendon strain after high-intensity drill, requires 10 days rest...')
                      : (isVi ? 'Ví dụ: Đã khám lại, gân cơ hồi phục tốt, cho phép tập nhẹ...' : 'e.g. Re-examined, tendons fully recovered, cleared for light training...')
                  }
                  required={willLock}
                  minLength={willLock ? 5 : undefined}
                  maxLength={500}
                />

                <div className="mt-2.5">
                  <div className="text-[11.5px] text-muted mb-1.5 font-medium">
                    {isVi ? 'Gợi ý lý do nhanh (bấm để chọn):' : 'Quick suggestions (click to use):'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickTemplates.map((tpl) => (
                      <Chip
                        key={tpl}
                        onClick={() => setReason(tpl)}
                        className="h-auto py-1 text-[11.5px] cursor-pointer hover:border-info"
                      >
                        + {tpl}
                      </Chip>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {loadingHistory ? (
              <p className="text-muted text-[13px] py-4 text-center">
                {isVi ? 'Đang tải lịch sử khóa tập…' : 'Loading lock history…'}
              </p>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-muted text-[13.5px]">
                {isVi ? 'Chưa có bản ghi lịch sử khóa / mở nào cho ngựa này.' : 'No lock/unlock history records found for this horse.'}
              </div>
            ) : (
              <div className="divide-y divide-line-soft max-h-[360px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {item.action === 'LOCK' ? (
                          <Badge tone="bad" className="gap-1">
                            <Icon name="lock" className="w-3 h-3" />
                            <span>{isVi ? 'Khóa tập' : 'Locked'}</span>
                          </Badge>
                        ) : (
                          <Badge tone="ok" className="gap-1">
                            <Icon name="unlock" className="w-3 h-3" />
                            <span>{isVi ? 'Mở khóa' : 'Unlocked'}</span>
                          </Badge>
                        )}
                        <span className="text-[12.5px] font-medium text-ink">
                          {item.lockedBy ? `${item.lockedBy.name} (${item.lockedBy.role})` : (isVi ? 'Hệ thống / Thú y' : 'System')}
                        </span>
                      </div>
                      <span className="text-[12px] text-muted whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink bg-subtle/60 rounded px-2.5 py-1.5 mt-1 border border-line-soft">
                      {item.reason}
                    </p>
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
        {tab === 'action' && (
          <Btn
            v={willLock ? 'd' : 'p'}
            type="submit"
            form="lock-horse-form"
            disabled={busy || (willLock && (!reason.trim() || reason.trim().length < 5))}
          >
            {busy
              ? (isVi ? 'Đang cập nhật…' : 'Updating…')
              : willLock
                ? (isVi ? 'Xác nhận khóa tập' : 'Confirm Lock')
                : (isVi ? 'Xác nhận mở khóa' : 'Confirm Unlock')}
          </Btn>
        )}
      </ModalFoot>
    </Modal>
  );
}
