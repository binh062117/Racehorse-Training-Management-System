import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      <ModalHead icon="alert" tone="bad" title={t('horseModal.deleteTitle')} id="delete-horse-title" onClose={() => !busy && onClose()} />
      <ModalBody>
        <p>
          {t('horseModal.deleteConfirm', {
            name: horse.name,
            breed: horse.breed ?? t('horsePage.breedUnknown'),
            owner: horse.owner.name,
          })}
        </p>
        <Alert tone="warn" icon="alert" title={t('horseModal.warningTitle')}>
          {t('horseModal.deleteWarning')}
        </Alert>
        <ErrorText err={err} />
      </ModalBody>
      <ModalFoot>
        <Btn onClick={onClose} disabled={busy}>{t('horseModal.cancel')}</Btn>
        <Btn v="d" onClick={() => void handleDelete()} disabled={busy}>{busy ? t('horseModal.deleting') : t('horseModal.confirmDelete')}</Btn>
      </ModalFoot>
    </Modal>
  );
}
