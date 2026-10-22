import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, Paginated, User, HorseGender, HorseStatus } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Btn, Field, Input, Modal, ModalBody, ModalFoot, ModalHead } from '../../ds/ui';

interface CreateHorseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateHorseModal({ isOpen, onClose, onCreated }: CreateHorseModalProps) {
  const { t } = useTranslation();
  const [owners, setOwners] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<HorseGender | ''>('MALE');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState<HorseStatus>('ACTIVE');
  const [saddleNumber, setSaddleNumber] = useState('');
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
        ...(saddleNumber ? { saddleNumber: Number(saddleNumber) } : {}),
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
      setSaddleNumber('');
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

  const selectCls = 'h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info';

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} labelledBy="create-horse-title">
      <ModalHead icon="horse" title={t('horseModal.createTitle')} id="create-horse-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
            <Field label={t('horseModal.name')} req>
              <Input placeholder={t('horseModal.exampleHorse')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </Field>

            <Field label={t('horseModal.owner')} req>
              <select className={selectCls} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
                <option value="" disabled>{t('horseModal.chooseOwner')}</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
              </select>
            </Field>

            <Field label={t('horseModal.gender')}>
              <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value as HorseGender | '')}>
                <option value="MALE">{t('horse.genderMale')}</option>
                <option value="FEMALE">{t('horse.genderFemale')}</option>
                <option value="">{t('horseModal.unknown')}</option>
              </select>
            </Field>

            <Field label={t('horseModal.saddleNumber')} hint={t('horseModal.saddleHint')}>
              <Input type="number" min={0} max={999} placeholder={t('horseModal.exampleNumber')} value={saddleNumber} onChange={(e) => setSaddleNumber(e.target.value)} />
            </Field>

            <Field label={t('horseModal.breed')}>
              <Input placeholder={t('horseModal.exampleBreed')} value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={120} />
            </Field>

            <Field label={t('horseModal.birthDate')}>
              <Input type="date" max={todayStr} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>

              <Field label={t('horseModal.initialStatus')}>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as HorseStatus)}>
                  {(['ACTIVE', 'RESTING', 'RETIRED'] as const).map((value) => (
                    <option key={value} value={value}>{t(`horseFlow.status.${value}`)}</option>
                  ))}
              </select>
            </Field>

              <Field label={t('horseModal.photo')} hint={t('horseModal.photoHint')}>
              <input
                type="file" accept="image/jpeg,image/png,image/webp" className="text-[13px]"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setPhoto(null);
                    setPreview(null);
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setErr(new Error(t('horseModal.photoTooLarge')));
                    return;
                  }
                  setPhoto(file);
                  setErr(null);
                  setPreview(URL.createObjectURL(file));
                }}
              />
              {preview && (
                <div className="mt-2 text-center">
                  <img src={preview} alt={t('horseModal.preview')} className="max-h-[120px] rounded-btn border border-line object-cover inline-block" />
                </div>
              )}
            </Field>
          </div>

          <ErrorText err={err} />
        </ModalBody>

        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{t('horseModal.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? t('horseModal.creating') : t('horseModal.create')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
