import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { ErrorText } from '../ErrorText';

interface PhotoUploadModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function PhotoUploadModal({ horse, isOpen, onClose, onUploaded }: PhotoUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen || !horse) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setErr(new Error('Kích thước ảnh tối đa là 5MB'));
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📷 Tải ảnh đại diện — {horse.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body form-grid">
            <p className="muted" style={{ margin: '0 0 10px', fontSize: '13px' }}>
              Chọn file hình ảnh định dạng JPG, PNG hoặc WEBP (dung lượng tối đa 5MB).
            </p>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              required
            />

            {preview && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '240px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            <ErrorText err={err} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !file}>
              {busy ? 'Đang tải lên...' : 'Tải lên ảnh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
