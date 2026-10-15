import { useState } from 'react';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Alert, Btn, Modal, ModalBody, ModalFoot, ModalHead } from '../../ds/ui';

interface DeleteHorseModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteHorseModal({ horse, isOpen, onClose, onDeleted }: DeleteHorseModalProps) {
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!horse) return null;

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
    <Modal open={isOpen} onClose={() => !busy && onClose()} labelledBy="delete-horse-title">
      <ModalHead icon="alert" tone="bad" title="Xác nhận xóa hồ sơ ngựa" id="delete-horse-title" onClose={() => !busy && onClose()} />
      <ModalBody>
        <p>
          Bạn có chắc chắn muốn xóa hồ sơ ngựa <strong>{horse.name}</strong> ({horse.breed ?? 'Chưa rõ giống'}) thuộc quyền sở hữu của <strong>{horse.owner.name}</strong>?
        </p>
        <Alert tone="warn" icon="alert" title="Lưu ý">
          Đây là hành động xóa mềm (soft-delete). Con ngựa này sẽ bị ẩn khỏi danh sách của câu lạc bộ, nhưng toàn bộ lịch sử thi đấu, giáo án tập luyện và hồ sơ bệnh án liên quan vẫn được lưu trữ bảo toàn.
        </Alert>
        <ErrorText err={err} />
      </ModalBody>
      <ModalFoot>
        <Btn onClick={onClose} disabled={busy}>Hủy</Btn>
        <Btn v="d" onClick={() => void handleDelete()} disabled={busy}>{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Btn>
      </ModalFoot>
    </Modal>
  );
}
