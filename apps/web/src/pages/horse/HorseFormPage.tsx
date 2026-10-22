import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import type { Horse, HorseGender, HorseStatus, Paginated, User } from '../../lib/types';
import { usePageChrome } from '../../ds/AppShell';
import { Btn, Card, Field, Input } from '../../ds/ui';

const HORSE_STATUSES: HorseStatus[] = ['ACTIVE', 'RESTING', 'RETIRED'];
const selectCls = 'h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info';

type HorseFormState = {
  name: string;
  gender: HorseGender | '';
  breed: string;
  birthDate: string;
  ownerId: string;
  status: HorseStatus;
  sireId: string;
  damId: string;
  fitnessScore: string;
};

const EMPTY_FORM: HorseFormState = {
  name: '',
  gender: '',
  breed: '',
  birthDate: '',
  ownerId: '',
  status: 'ACTIVE',
  sireId: '',
  damId: '',
  fitnessScore: '',
};

export function HorseFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<HorseFormState>(EMPTY_FORM);
  const [owners, setOwners] = useState<User[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [ownerResponse, horseResponse, detailResponse] = await Promise.all([
          api.get<Paginated<User>>('/users', { params: { role: 'OWNER', limit: 100 } }),
          api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } }),
          id ? api.get<Horse>(`/horses/${id}`) : Promise.resolve(null),
        ]);
        if (!active) return;
        setOwners(ownerResponse.data.data);
        setHorses(horseResponse.data.data);
        if (detailResponse) {
          const horse = detailResponse.data;
          setForm({
            name: horse.name,
            gender: horse.gender ?? '',
            breed: horse.breed ?? '',
            birthDate: horse.birthDate?.slice(0, 10) ?? '',
            ownerId: horse.ownerId,
            status: horse.status,
            sireId: horse.sireId ?? '',
            damId: horse.damId ?? '',
            fitnessScore: horse.fitnessScore?.toString() ?? '',
          });
        }
      } catch (error) {
        if (active) setLoadError(error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  usePageChrome({ crumbs: [[t('nav.horses'), '/horses'], id ? t('horseFlow.editHorse') : t('horseFlow.addHorse')] });

  const setValue = <K extends keyof HorseFormState>(key: K, value: HorseFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const body = id
        ? {
            name: form.name.trim(),
            gender: form.gender ? form.gender : null,
            breed: form.breed.trim() || null,
            birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00`).toISOString() : null,
            ownerId: form.ownerId,
            status: form.status,
            sireId: form.sireId || null,
            damId: form.damId || null,
            fitnessScore: form.fitnessScore === '' ? null : Number(form.fitnessScore),
          }
        : {
            name: form.name.trim(),
            gender: form.gender ? form.gender : undefined,
            breed: form.breed.trim() || undefined,
            birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00`).toISOString() : undefined,
            ownerId: form.ownerId,
            status: form.status,
          };
      const response = id
        ? await api.patch<Horse>(`/horses/${id}`, body)
        : await api.post<Horse>('/horses', body);
      if (photo) {
        const payload = new FormData();
        payload.append('file', photo);
        await api.post(`/horses/${response.data.id}/photo`, payload);
      }
      navigate(`/horses/${response.data.id}`);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="cap">{t('horseFlow.loading')}</p>;
  if (loadError) return <ErrorText err={loadError} />;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <p className="lbl">{t('horseFlow.managementEyebrow')}</p>
        <h1 className="text-lg font-semibold mt-0.5">{id ? t('horseFlow.editHorse') : t('horseFlow.addHorse')}</h1>
        <p className="cap mt-0.5">{t('horseFlow.formDescription')}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card className="p-5 flex flex-col gap-3.5">
          <h2 className="font-semibold text-[15px]">{t('horseFlow.identitySection')}</h2>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
            <Field label={t('horse.name')}>
              <Input value={form.name} onChange={(event) => setValue('name', event.target.value)} required maxLength={120} />
            </Field>
            <Field label={t('horse.gender')}>
              <select className={selectCls} value={form.gender} onChange={(event) => setValue('gender', event.target.value as HorseGender | '')}>
                <option value="">— {t('horse.genderUnknown')} —</option>
                <option value="MALE">{t('horse.genderMale')}</option>
                <option value="FEMALE">{t('horse.genderFemale')}</option>
              </select>
            </Field>
            <Field label={t('horse.breed')}>
              <Input value={form.breed} onChange={(event) => setValue('breed', event.target.value)} maxLength={120} />
            </Field>
            <Field label={t('horse.birthDate')}>
              <Input type="date" value={form.birthDate} onChange={(event) => setValue('birthDate', event.target.value)} />
            </Field>
            <Field label={t('horse.owner')}>
              <select className={selectCls} value={form.ownerId} onChange={(event) => setValue('ownerId', event.target.value)} required>
                <option value="">{t('horseFlow.selectOwner')}</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>)}
              </select>
            </Field>
            <Field label={t('horse.status')}>
              <select className={selectCls} value={form.status} onChange={(event) => setValue('status', event.target.value as HorseStatus)}>
                {HORSE_STATUSES.map((status) => <option key={status} value={status}>{t(`horseFlow.status.${status}`)}</option>)}
              </select>
            </Field>
            <Field label={t('horseFlow.photo')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="text-[12.5px]" />
            </Field>
          </div>
        </Card>

        {id && (
          <Card className="p-5 flex flex-col gap-3.5">
            <h2 className="font-semibold text-[15px]">{t('horseFlow.pedigreeAndFitness')}</h2>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
              <Field label={t('horseFlow.sire')}>
                <select className={selectCls} value={form.sireId} onChange={(event) => setValue('sireId', event.target.value)}>
                  <option value="">{t('horseFlow.unknown')}</option>
                  {horses.filter((horse) => horse.id !== id && horse.id !== form.damId).map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
                </select>
              </Field>
              <Field label={t('horseFlow.dam')}>
                <select className={selectCls} value={form.damId} onChange={(event) => setValue('damId', event.target.value)}>
                  <option value="">{t('horseFlow.unknown')}</option>
                  {horses.filter((horse) => horse.id !== id && horse.id !== form.sireId).map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
                </select>
              </Field>
              <Field label={t('horseFlow.fitnessScore')}>
                <Input type="number" min="0" max="100" value={form.fitnessScore} onChange={(event) => setValue('fitnessScore', event.target.value)} />
              </Field>
            </div>
          </Card>
        )}

        {saveError && <ErrorText err={saveError} />}
        <div className="flex gap-2">
          <Btn v="p" type="submit" disabled={saving || !user}>
            {saving ? t('horseFlow.saving') : id ? t('common.save') : t('horseFlow.createRecord')}
          </Btn>
          <Btn to={id ? `/horses/${id}` : '/horses'}>{t('common.cancel')}</Btn>
        </div>
      </form>
    </div>
  );
}
