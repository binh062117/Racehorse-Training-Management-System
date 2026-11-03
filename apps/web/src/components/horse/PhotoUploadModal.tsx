import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { FileInput, Btn, Modal, ModalBody, ModalFoot, ModalHead } from '../../ds/ui';

interface PhotoUploadModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function PhotoUploadModal({ horse, isOpen, onClose, onUploaded }: PhotoUploadModalProps) {
  useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!horse) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setErr(new Error(i18n.t("ui.theMaximumImageSizeIs5Mb")));
      return;
    }
    setFile(selected);
    setErr(null);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setErr(null);
    setBusy(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/horses/${horse.id}/photo`, formData);
      onUploaded();
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} labelledBy="photo-upload-title">
      <ModalHead icon="camera" title={i18n.t('ui.uploadHorsePhoto', { name: horse.name })} id="photo-upload-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <p className="cap">{i18n.t("ui.selectAJpgPngOrWebpImageMaximum5Mb")}</p>
          <FileInput type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} required className="text-[13px]" />
          {preview && (
            <div className="text-center">
              <img src={preview} alt={i18n.t("ui.preview")} className="max-w-full max-h-60 rounded-card border border-line object-cover inline-block" />
            </div>
          )}
          <ErrorText err={err} />
        </ModalBody>
        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{i18n.t("ui.cancel")}</Btn>
          <Btn v="p" type="submit" disabled={busy || !file}>{busy ? i18n.t("ui.uploading") : i18n.t("ui.uploadPhoto")}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
