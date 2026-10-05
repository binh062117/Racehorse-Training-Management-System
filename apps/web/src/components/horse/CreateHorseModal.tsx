import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Paginated, User, HorseGender, HorseStatus } from '../../lib/types';
import { Field } from '../Field';
import { ErrorText } from '../ErrorText';

interface CreateHorseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateHorseModal({ isOpen, onClose, onCreated }: CreateHorseModalProps) {
  const [owners, setOwners] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<HorseGender | ''>('MALE');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState<HorseStatus>('ACTIVE');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    api
      .get<Paginated<User>>('/users', { params: { role: 'OWNER', limit: 100 } })
      .then((r) => setOwners(r.data.data))
      .catch(() => setOwners([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const created = await api.post<Horse>('/horses', {
        name: name.trim(),
        ownerId,
        ...(gender ? { gender } : {}),
        ...(breed.trim() ? { breed: breed.trim() } : {}),
        ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
        status,
      });

      if (photo) {
        const formData = new FormData();
        formData.append('file', photo);
        await api.post(`/horses/${created.data.id}/photo`, formData);
      }

      setName('');
      setGender('MALE');
      setBreed('');
      setBirthDate('');
      setOwnerId('');
      setStatus('ACTIVE');
      setPhoto(null);
      setPreview(null);
      onCreated();
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
          <h3 className="modal-title">＋ Thêm hồ sơ ngựa mới</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body form-grid">
            <Field label="Tên ngựa *">
              <input
                className="input"
                placeholder="vd: Thunderbolt"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </Field>

            <Field label="Chủ sở hữu *">
              <select
                className="input"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                required
              >
                <option value="" disabled>
                  — Chọn chủ sở hữu —
                </option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.email})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Giới tính">
              <select
                className="input"
                value={gender}
                onChange={(e) => setGender(e.target.value as HorseGender | '')}
              >
                <option value="MALE">Đực</option>
                <option value="FEMALE">Cái</option>
                <option value="">— Chưa rõ —</option>
              </select>
            </Field>

            <Field label="Giống loài">
              <input
                className="input"
                placeholder="vd: Thoroughbred, Arabian..."
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                maxLength={120}
              />
            </Field>

            <Field label="Ngày sinh">
              <input
                className="input"
                type="date"
                max={todayStr}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>

            <Field label="Trạng thái ban đầu">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as HorseStatus)}
              >
                <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                <option value="RESTING">Nghỉ dưỡng (RESTING)</option>
                <option value="RETIRED">Giải nghệ (RETIRED)</option>
              </select>
            </Field>

            <Field label="Ảnh đại diện (tùy chọn)" hint="Định dạng JPG, PNG, WEBP (tối đa 5MB)">
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setPhoto(null);
                    setPreview(null);
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setErr(new Error('Kích thước ảnh tối đa là 5MB'));
                    return;
                  }
                  setPhoto(file);
                  setErr(null);
                  setPreview(URL.createObjectURL(file));
                }}
              />
              {preview && (
                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{
                      maxHeight: '120px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      border: '1px solid var(--border-default)',
                    }}
                  />
                </div>
              )}
            </Field>

            <ErrorText err={err} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang tạo...' : 'Tạo hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
