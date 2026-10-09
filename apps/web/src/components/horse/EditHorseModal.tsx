import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Paginated, User, Horse, HorseGender, HorseStatus } from '../../lib/types';
import { Field } from '../Field';
import { ErrorText } from '../ErrorText';

interface EditHorseModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditHorseModal({ horse, isOpen, onClose, onUpdated }: EditHorseModalProps) {
  const [owners, setOwners] = useState<User[]>([]);
  const [allHorses, setAllHorses] = useState<Horse[]>([]);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<HorseGender | ''>('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState<HorseStatus>('ACTIVE');
  const [sireId, setSireId] = useState('');
  const [damId, setDamId] = useState('');
  const [fitnessScore, setFitnessScore] = useState<string>('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !horse) return;
    setErr(null);
    setName(horse.name);
    setGender(horse.gender ?? '');
    setBreed(horse.breed ?? '');
    setBirthDate(horse.birthDate ? horse.birthDate.slice(0, 10) : '');
    setOwnerId(horse.ownerId);
    setStatus(horse.status);
    setSireId(horse.sireId ?? '');
    setDamId(horse.damId ?? '');
    setFitnessScore(horse.fitnessScore != null ? String(horse.fitnessScore) : '');

    // Fetch owners
    api
      .get<Paginated<User>>('/users', { params: { role: 'OWNER', limit: 100 } })
      .then((r) => setOwners(r.data.data))
      .catch(() => setOwners([]));

    // Fetch horses for pedigree selection (exclude self)
    api
      .get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
      .then((r) => setAllHorses(r.data.data.filter((h) => h.id !== horse.id)))
      .catch(() => setAllHorses([]));
  }, [isOpen, horse]);

  if (!isOpen || !horse) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    // Front-end validate pedigree
    if (sireId && damId && sireId === damId) {
      setErr(new Error('Ngựa cha và ngựa mẹ không thể là cùng một con ngựa'));
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        ownerId,
        gender: gender ? gender : null,
        breed: breed.trim() ? breed.trim() : null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        status,
        sireId: sireId ? sireId : null,
        damId: damId ? damId : null,
        fitnessScore: fitnessScore !== '' ? Number(fitnessScore) : null,
      };

      await api.patch(`/horses/${horse.id}`, payload);
      onUpdated();
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
          <h3 className="modal-title">✎ Chỉnh sửa hồ sơ ngựa</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body form-grid">
            <Field label="Tên ngựa *">
              <input
                className="input"
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
                <option value="">— Chưa rõ —</option>
                <option value="MALE">Đực</option>
                <option value="FEMALE">Cái</option>
              </select>
            </Field>

            <div className="form-grid-2">
              <Field label="Giống loài">
                <input
                  className="input"
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
            </div>

            <div className="form-grid-2">
              <Field label="Trạng thái">
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

              <Field label="Điểm thể trạng (0-100)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Chưa đánh giá"
                  value={fitnessScore}
                  onChange={(e) => setFitnessScore(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: '8px', padding: '12px', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '8px' }}>
                🧬 Phả hệ (Pedigree)
              </div>
              <div className="form-grid-2">
                <Field label="Ngựa cha (Sire)">
                  <select
                    className="input"
                    value={sireId}
                    onChange={(e) => setSireId(e.target.value)}
                  >
                    <option value="">— Không chọn —</option>
                    {allHorses
                      .filter((h) => h.id !== damId)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.breed ?? '—'})
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Ngựa mẹ (Dam)">
                  <select
                    className="input"
                    value={damId}
                    onChange={(e) => setDamId(e.target.value)}
                  >
                    <option value="">— Không chọn —</option>
                    {allHorses
                      .filter((h) => h.id !== sireId)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.breed ?? '—'})
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            </div>

            <ErrorText err={err} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
