import { useState } from 'react';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { ErrorText } from '../ErrorText';

interface DeleteHorseModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteHorseModal({ horse, isOpen, onClose, onDeleted }: DeleteHorseModalProps) {
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen || !horse) return null;

  const handleDelete = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.delete(`/horses/${horse.id}`);
      onDeleted();
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: 'var(--status-danger)' }}>
            ⚠ Xác nhận xóa hồ sơ ngựa
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: '0 0 14px', lineHeight: 1.6 }}>
            Bạn có chắc chắn muốn xóa hồ sơ ngựa <strong>{horse.name}</strong> ({horse.breed ?? 'Chưa rõ giống'}) thuộc quyền sở hữu của <strong>{horse.owner.name}</strong>?
          </p>
          <div style={{ padding: '12px 14px', background: 'var(--status-warning-bg)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '13px', color: 'var(--status-warning)' }}>
            <strong>Lưu ý:</strong> Đây là hành động xóa mềm (soft-delete). Con ngựa này sẽ bị ẩn khỏi danh sách của câu lạc bộ, nhưng toàn bộ lịch sử thi đấu, giáo án tập luyện và hồ sơ bệnh án liên quan vẫn được lưu trữ bảo toàn.
          </div>
          <ErrorText err={err} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={busy}
          >
            {busy ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
