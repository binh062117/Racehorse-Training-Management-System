import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import { formatDate } from '../lib/format';
import type { Horse, Paginated, Vaccination } from '../lib/types';

export function HealthSchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [careType, setCareType] = useState<'ALL' | 'VACCINATION' | 'DEWORMING'>('ALL');

  const vaccinationParams = {
    limit: 100,
    ...(upcomingOnly ? { upcoming: true } : {}),
    ...(careType !== 'ALL' ? { careType } : {}),
  };
  const {
    data: records,
    error,
    reload: load,
  } = useCachedResource(`vaccinations:${JSON.stringify(vaccinationParams)}`, () =>
    api
      .get<Paginated<Vaccination>>('/vaccinations', { params: vaccinationParams })
      .then((r) => r.data.data),
  );

  const changeFilter = (nextUpcomingOnly: boolean) => {
    setUpcomingOnly(nextUpcomingOnly);
  };

  return (
    <div className="horse-workspace health-schedule-page">
      <section className="horse-page-heading">
        <div>
          <p className="eyebrow">{t('healthSchedule.eyebrow')}</p>
          <h1>{t('healthSchedule.title')}</h1>
          <p className="muted">{t('healthSchedule.description')}</p>
        </div>
      </section>

      {user?.role === 'VET' && <CreateVaccinationForm onCreated={load} />}

      <section className="health-schedule-section">
        <div className="health-schedule-toolbar">
          <div className="health-schedule-tabs" role="group" aria-label={t('healthSchedule.status')}>
            <button
              type="button"
              className={upcomingOnly ? 'active' : ''}
              aria-pressed={upcomingOnly}
              onClick={() => changeFilter(true)}
            >
              {t('healthSchedule.upcoming')}
            </button>
            <button
              type="button"
              className={!upcomingOnly ? 'active' : ''}
              aria-pressed={!upcomingOnly}
              onClick={() => changeFilter(false)}
            >
              {t('healthSchedule.all')}
            </button>
          </div>
          <span className="health-schedule-count">{records?.length ?? 0}</span>
        </div>
        <div className="health-schedule-tabs" role="group" aria-label={t('healthSchedule.kind')}>
          {(['ALL', 'VACCINATION', 'DEWORMING'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={careType === type ? 'active' : ''}
              aria-pressed={careType === type}
              onClick={() => setCareType(type)}
            >
              {t(`healthSchedule.kindOptions.${type}`)}
            </button>
          ))}
        </div>
        {error ? (
          <ErrorText err={error} />
        ) : records === null ? (
          <p className="muted">…</p>
        ) : records.length === 0 ? (
          <div className="horse-empty-state">
            <p>{t(upcomingOnly ? 'healthSchedule.emptyUpcoming' : 'healthSchedule.emptyAll')}</p>
          </div>
        ) : (
          <div className="health-schedule-table-wrap">
            <table className="health-schedule-table">
              <thead>
                <tr>
                  <th>{t('healthSchedule.horse')}</th>
                  <th>{t('healthSchedule.item')}</th>
                  <th>{t('healthSchedule.lastDate')}</th>
                  <th>{t('healthSchedule.nextDue')}</th>
                  <th>{t('healthSchedule.status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {record.horse ? (
                        <Link to={`/horses/${record.horse.id}`}>{record.horse.name}</Link>
                      ) : '—'}
                    </td>
                    <td>
                      <strong>{record.vaccineName}</strong>
                      <small className="muted">{t(`healthSchedule.kindOptions.${record.careType ?? 'VACCINATION'}`)}</small>
                    </td>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.nextDueDate ? formatDate(record.nextDueDate) : t('healthSchedule.noDueDate')}</td>
                    <td><DueStatus date={record.nextDueDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DueStatus({ date }: { date: string | null }) {
  const { t } = useTranslation();
  if (!date) return <span className="health-schedule-badge neutral">{t('healthSchedule.noDueDate')}</span>;
  const due = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (daysUntilDue < 0) return <span className="health-schedule-badge danger">{t('healthSchedule.overdue')}</span>;
  if (daysUntilDue <= 14) return <span className="health-schedule-badge warning">{t('healthSchedule.dueSoon')}</span>;
  return <span className="health-schedule-badge success">{t('healthSchedule.scheduled')}</span>;
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
    <form className="health-schedule-form" onSubmit={submit}>
      <div className="health-schedule-form-heading">
        <h2>{t('healthSchedule.new')}</h2>
      </div>
      <div className="health-schedule-form-grid">
        <Field label={t('healthSchedule.horse')}>
          <select className="input" value={horseId} onChange={(event) => setHorseId(event.target.value)} required>
            <option value="">{t('healthSchedule.selectHorse')}</option>
            {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
          </select>
        </Field>
        <Field label={t('healthSchedule.kind')}>
          <select className="input" value={careType} onChange={(event) => setCareType(event.target.value as typeof careType)}>
            <option value="VACCINATION">{t('healthSchedule.kindOptions.VACCINATION')}</option>
            <option value="DEWORMING">{t('healthSchedule.kindOptions.DEWORMING')}</option>
          </select>
        </Field>
        <Field label={t('healthSchedule.item')}>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        </Field>
        <Field label={t('healthSchedule.lastDate')}>
          <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label={t('healthSchedule.nextDue')}>
          <input className="input" type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} />
        </Field>
      </div>
      <ErrorText err={error} />
      <button className="btn btn-primary" type="submit" disabled={saving || horses.length === 0}>
        {saving ? t('healthSchedule.saving') : t('common.create')}
      </button>
    </form>
  );
}