import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import { formatDate } from '../lib/format';
import type { Horse, Paginated, Vaccination } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Chip, Field, Icon, Input } from '../ds/ui';

export function HealthSchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [careType, setCareType] = useState<'ALL' | 'VACCINATION' | 'DEWORMING'>('ALL');

  usePageChrome({ crumbs: [t('healthSchedule.eyebrow'), t('healthSchedule.title')] });

  const vaccinationParams = {
    limit: 100,
    ...(upcomingOnly ? { upcoming: true } : {}),
    ...(careType !== 'ALL' ? { careType } : {}),
  };
  const { data: records, error, reload: load } = useCachedResource(`vaccinations:${JSON.stringify(vaccinationParams)}`, () =>
    api.get<Paginated<Vaccination>>('/vaccinations', { params: vaccinationParams }).then((r) => r.data.data),
  );

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-2">
        <div className="lbl">{t('healthSchedule.eyebrow')}</div>
        <h1 className="disp text-[56px] mt-1">{t('healthSchedule.title')}</h1>
        <p className="text-hero-muted max-w-[560px]">{t('healthSchedule.description')}</p>
      </section>

      {user?.role === 'VET' && <CreateVaccinationForm onCreated={load} />}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
          <div className="flex gap-2">
            <Chip on={upcomingOnly} onClick={() => setUpcomingOnly(true)}>{t('healthSchedule.upcoming')}</Chip>
            <Chip on={!upcomingOnly} onClick={() => setUpcomingOnly(false)}>{t('healthSchedule.all')}</Chip>
          </div>
          <span className="cap num">{records?.length ?? 0}</span>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {(['ALL', 'VACCINATION', 'DEWORMING'] as const).map((type) => (
            <Chip key={type} on={careType === type} onClick={() => setCareType(type)}>{t(`healthSchedule.kindOptions.${type}`)}</Chip>
          ))}
        </div>

        {error ? (
          <div className="p-5"><ErrorText err={error} /></div>
        ) : records === null ? (
          <p className="cap p-5">…</p>
        ) : records.length === 0 ? (
          <div className="p-10 text-center"><p className="cap">{t(upcomingOnly ? 'healthSchedule.emptyUpcoming' : 'healthSchedule.emptyAll')}</p></div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('healthSchedule.horse'), t('healthSchedule.item'), t('healthSchedule.lastDate'), t('healthSchedule.nextDue'), t('healthSchedule.status')].map((th) => (
                    <th key={th} className="h-[42px] px-5 bg-cream lbl border-y border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-line-soft hover:bg-subtle">
                    <td className="px-5 py-3">{record.horse ? <Link to={`/horses/${record.horse.id}`} className="font-semibold text-navy no-underline">{record.horse.name}</Link> : '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <strong>{record.vaccineName}</strong>
                        <Badge tone="neu">{t(`healthSchedule.kindOptions.${record.careType ?? 'VACCINATION'}`)}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3">{formatDate(record.date)}</td>
                    <td className="px-5 py-3">{record.nextDueDate ? formatDate(record.nextDueDate) : t('healthSchedule.noDueDate')}</td>
                    <td className="px-5 py-3"><DueStatus date={record.nextDueDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function DueStatus({ date }: { date: string | null }) {
  const { t } = useTranslation();
  if (!date) return <Badge tone="neu">{t('healthSchedule.noDueDate')}</Badge>;
  const due = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (daysUntilDue < 0) return <Badge tone="bad">{t('healthSchedule.overdue')}</Badge>;
  if (daysUntilDue <= 14) return <Badge tone="warn">{t('healthSchedule.dueSoon')}</Badge>;
  return <Badge tone="ok">{t('healthSchedule.scheduled')}</Badge>;
}

function CreateVaccinationForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useTranslation();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState('');
  const [careType, setCareType] = useState<'VACCINATION' | 'DEWORMING'>('VACCINATION');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
      .then((response) => setHorses(response.data.data))
      .catch(setError);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/horses/${horseId}/vaccinations`, {
        careType,
        vaccineName: name.trim(),
        date: new Date(`${date}T00:00:00`).toISOString(),
        ...(nextDueDate ? { nextDueDate: new Date(`${nextDueDate}T00:00:00`).toISOString() } : {}),
      });
      setName('');
      setDate('');
      setNextDueDate('');
      await onCreated();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="p-5 flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold">{t('healthSchedule.new')}</h2>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
          <Field label={t('healthSchedule.horse')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              required
            >
              <option value="">{t('healthSchedule.selectHorse')}</option>
              {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
          <Field label={t('healthSchedule.kind')}>
            <select
              className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
              value={careType}
              onChange={(e) => setCareType(e.target.value as 'VACCINATION' | 'DEWORMING')}
            >
              <option value="VACCINATION">{t('healthSchedule.kindOptions.VACCINATION')}</option>
              <option value="DEWORMING">{t('healthSchedule.kindOptions.DEWORMING')}</option>
            </select>
          </Field>
          <Field label={t('healthSchedule.item')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <Field label={t('healthSchedule.lastDate')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={t('healthSchedule.nextDue')}>
            <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </Field>
        </div>
        <ErrorText err={error} />
        <Btn v="p" type="submit" disabled={saving || horses.length === 0} className="self-start">
          <Icon name="plus" />{saving ? t('healthSchedule.saving') : t('common.create')}
        </Btn>
      </Card>
    </form>
  );
}
