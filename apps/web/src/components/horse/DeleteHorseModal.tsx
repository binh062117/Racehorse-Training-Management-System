import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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
  useTranslation();
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
      <ModalHead icon="alert" tone="bad" title={i18n.t("ui.confirmHorseDeletion")} id="delete-horse-title" onClose={() => !busy && onClose()} />
      <ModalBody>
        <p>
          {i18n.t("ui.areYouSureYouWantToDeleteTheHorseProfile")}{' '}<strong>{horse.name}</strong> ({horse.breed ?? i18n.t("ui.unknownBreed2")}{i18n.t("ui.ownedBy")}{' '}<strong>{horse.owner.name}</strong>?
        </p>
        <Alert tone="warn" icon="alert" title={i18n.t("ui.pleaseNote")}>
          {i18n.t("ui.theHorseWillBeHiddenFromTheClubListItsRaceHistoryTrainingPlansAndMedic")}</Alert>
        <ErrorText err={err} />
      </ModalBody>
      <ModalFoot>
        <Btn onClick={onClose} disabled={busy}>{i18n.t("ui.cancel")}</Btn>
        <Btn v="d" onClick={() => void handleDelete()} disabled={busy}>{busy ? i18n.t("ui.deleting") : i18n.t("ui.confirmDeletion")}</Btn>
      </ModalFoot>
    </Modal>
  );
}
