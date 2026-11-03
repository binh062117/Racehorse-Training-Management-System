import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useState, useEffect, type FormEvent } from 'react';
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
  useTranslation();
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

  const selectCls = 'h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15';

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} labelledBy="create-horse-title">
      <ModalHead icon="horse" title={i18n.t("ui.addHorseProfile")} id="create-horse-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
            <Field label={i18n.t("ui.horseName")} req>
              <Input placeholder={i18n.t("ui.eGThunderbolt")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </Field>

            <Field label={i18n.t("ui.owner2")} req>
              <select className={selectCls} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
                <option value="" disabled>{i18n.t("ui.selectOwner")}</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
              </select>
            </Field>

            <Field label={i18n.t("horse.gender")}>
              <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value as HorseGender | '')}>
                <option value="MALE">{i18n.t("horse.genderMale")}</option>
                <option value="FEMALE">{i18n.t("horse.genderFemale")}</option>
                <option value="">{i18n.t("ui.unknown")}</option>
              </select>
            </Field>

            <Field label={i18n.t("ui.saddleNumberOptional")} hint="Số hiển thị trên yếm số (saddle cloth)">
              <Input type="number" min={0} max={999} placeholder={i18n.t("ui.eG7")} value={saddleNumber} onChange={(e) => setSaddleNumber(e.target.value)} />
            </Field>

            <Field label={i18n.t("ui.breed")}>
              <Input placeholder={i18n.t("ui.eGThoroughbredArabian")} value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={120} />
            </Field>

            <Field label={i18n.t("horse.birthDate")}>
              <Input type="date" max={todayStr} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>

            <Field label={i18n.t("ui.initialStatus")}>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as HorseStatus)}>
                <option value="ACTIVE">{i18n.t("ui.active")}</option>
                <option value="RESTING">{i18n.t("ui.resting2")}</option>
                <option value="RETIRED">{i18n.t("ui.retired")}</option>
              </select>
            </Field>

            <Field label={i18n.t("ui.profilePhotoOptional")} hint={i18n.t("ui.jpgPngOrWebpMaximum5Mb")}>
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
                    setErr(new Error(i18n.t("ui.theMaximumImageSizeIs5Mb")));
                    return;
                  }
                  setPhoto(file);
                  setErr(null);
                  setPreview(URL.createObjectURL(file));
                }}
              />
              {preview && (
                <div className="mt-2 text-center">
                  <img src={preview} alt="Preview" className="max-h-[120px] rounded-btn border border-line object-cover inline-block" />
                </div>
              )}
            </Field>
          </div>

          <ErrorText err={err} />
        </ModalBody>

        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{i18n.t("ui.cancel")}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{busy ? i18n.t("ui.creating") : i18n.t("horseFlow.createRecord")}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
