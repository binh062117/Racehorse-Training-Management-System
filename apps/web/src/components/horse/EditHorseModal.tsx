import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Paginated, User, Horse, HorseGender, HorseStatus } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Btn, Field, Input, Modal, ModalBody, ModalFoot, ModalHead } from '../../ds/ui';

interface EditHorseModalProps {
  horse: Horse | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditHorseModal({ horse, isOpen, onClose, onUpdated }: EditHorseModalProps) {
  const { t } = useTranslation();
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
  const [saddleNumber, setSaddleNumber] = useState<string>('');
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
    setSaddleNumber(horse.saddleNumber != null ? String(horse.saddleNumber) : '');

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

  if (!horse) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    // Front-end validate pedigree
    if (sireId && damId && sireId === damId) {
      setErr(new Error(t('horseModal.parentsMustDiffer')));
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
        saddleNumber: saddleNumber !== '' ? Number(saddleNumber) : null,
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

  const selectCls = 'h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info';

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} labelledBy="edit-horse-title">
      <ModalHead icon="edit" title={t('horseModal.editTitle')} id="edit-horse-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <Field label={t('horseModal.name')} req>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </Field>

          <Field label={t('horseModal.owner')} req>
            <select className={selectCls} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
            </select>
          </Field>

          <Field label={t('horseModal.gender')}>
            <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value as HorseGender | '')}>
              <option value="">{t('horseModal.unknown')}</option>
              <option value="MALE">{t('horse.genderMale')}</option>
              <option value="FEMALE">{t('horse.genderFemale')}</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label={t('horseModal.breed')}>
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t('horseModal.birthDate')}>
              <Input type="date" max={todayStr} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
              <Field label={t('horseModal.status')}>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as HorseStatus)}>
                  {(['ACTIVE', 'RESTING', 'RETIRED'] as const).map((value) => (
                    <option key={value} value={value}>{t(`horseFlow.status.${value}`)}</option>
                  ))}
              </select>
            </Field>
              <Field label={t('horseModal.fitness')}>
                <Input type="number" min={0} max={100} placeholder={t('horseModal.fitnessUnknown')} value={fitnessScore} onChange={(e) => setFitnessScore(e.target.value)} />
            </Field>
          </div>

          <Field label={t('horseModal.saddleNumber')} hint={t('horseModal.saddleHint')}>
            <Input type="number" min={0} max={999} placeholder={t('horseModal.exampleNumber')} value={saddleNumber} onChange={(e) => setSaddleNumber(e.target.value)} />
          </Field>

          <div className="p-3 rounded-card border border-line bg-subtle">
            <div className="lbl text-navy mb-2">{t('horseModal.pedigree')}</div>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t('horseModal.sire')}>
                <select className={selectCls} value={sireId} onChange={(e) => setSireId(e.target.value)}>
                  <option value="">{t('horseModal.noSelection')}</option>
                  {allHorses.filter((h) => h.id !== damId).map((h) => <option key={h.id} value={h.id}>{h.name} ({h.breed ?? '—'})</option>)}
                </select>
              </Field>
              <Field label={t('horseModal.dam')}>
                <select className={selectCls} value={damId} onChange={(e) => setDamId(e.target.value)}>
                  <option value="">{t('horseModal.noSelection')}</option>
                  {allHorses.filter((h) => h.id !== sireId).map((h) => <option key={h.id} value={h.id}>{h.name} ({h.breed ?? '—'})</option>)}
                </select>
              </Field>
            </div>
          </div>

          <ErrorText err={err} />
        </ModalBody>

        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{t('horseModal.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? t('horseModal.saving') : t('horseModal.save')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
