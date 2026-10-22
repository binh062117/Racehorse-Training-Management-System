import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Btn, Modal, ModalBody, ModalFoot, ModalHead } from '../../ds/ui';

interface PhotoUploadModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function PhotoUploadModal({ horse, isOpen, onClose, onUploaded }: PhotoUploadModalProps) {
  const { t } = useTranslation();
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
      setErr(new Error(t('horseModal.photoTooLarge')));
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
      <ModalHead icon="camera" title={t('horseModal.uploadPhotoTitle', { name: horse.name })} id="photo-upload-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <p className="cap">{t('horseModal.uploadPhotoHint')}</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} required className="text-[13px]" />
          {preview && (
            <div className="text-center">
              <img src={preview} alt={t('horseModal.preview')} className="max-w-full max-h-60 rounded-card border border-line object-cover inline-block" />
            </div>
          )}
          <ErrorText err={err} />
        </ModalBody>
        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{t('horseModal.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || !file}>{busy ? t('horseModal.uploading') : t('horseModal.uploadPhoto')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
