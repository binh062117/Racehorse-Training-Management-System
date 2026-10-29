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
import { Badge, Btn, Card, Chip, EmptyState, Field, Icon, Input, NativeSelect, PageHeader, Seg } from '../ds/ui';

export function HealthSchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [careType, setCareType] = useState<'ALL' | 'VACCINATION' | 'DEWORMING'>('ALL');

  usePageChrome({ crumbs: [t('nav.healthSection', 'Sức khỏe'), t('healthSchedule.title')] });

  const vaccinationParams = {
    limit: 100,
    ...(upcomingOnly ? { upcoming: true } : {}),
    ...(careType !== 'ALL' ? { careType } : {}),
  };
  const { data: records, error, reload: load } = useCachedResource(`vaccinations:${JSON.stringify(vaccinationParams)}`, () =>
    api.get<Paginated<Vaccination>>('/vaccinations', { params: vaccinationParams }).then((r) => r.data.data),
  );

  const isVet = user?.role === 'VET';
  const [formOpen, setFormOpen] = useState(false);

  const list = records ?? [];
  const overdue = list.filter((r) => daysUntil(r.nextDueDate) != null && daysUntil(r.nextDueDate)! < 0).length;
  const dueSoon = list.filter((r) => { const d = daysUntil(r.nextDueDate); return d != null && d >= 0 && d <= 14; }).length;
  const sub = records === null
    ? t('healthSchedule.subLoading', 'Đang tải lịch…')
    : overdue > 0
      ? t('healthSchedule.subOverdue', {
          overdue,
          dueSoon: dueSoon ? t('healthSchedule.andDueSoon', { count: dueSoon }) : '',
        })
      : dueSoon > 0
        ? t('healthSchedule.subDueSoon', { dueSoon })
        : t('healthSchedule.subAllGood', 'Không có lịch nào quá hạn hay sắp đến hạn.');
  const th = 'h-10 px-4 text-[12px] font-medium text-muted border-b border-line';

  return (
    <>
      <PageHeader
        title={t('healthSchedule.title')}
        sub={sub}
        actions={isVet && !formOpen ? <Btn v="p" onClick={() => setFormOpen(true)}><Icon name="plus" />{t('healthSchedule.new')}</Btn> : undefined}
      />

      {isVet && formOpen && <CreateVaccinationForm onCreated={load} onClose={() => setFormOpen(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        <Seg value={upcomingOnly ? 'up' : 'all'} onChange={(k) => setUpcomingOnly(k === 'up')}
          options={[['up', t('healthSchedule.upcoming')], ['all', t('healthSchedule.all')]]} />
        <span className="w-px h-5 bg-line-strong mx-1 hidden sm:block" aria-hidden />
        {(['ALL', 'VACCINATION', 'DEWORMING'] as const).map((type) => (
          <Chip key={type} on={careType === type} onClick={() => setCareType(type)}>{t(`healthSchedule.kindOptions.${type}`)}</Chip>
        ))}
      </div>

      {error ? (
        <ErrorText err={error} />
      ) : records === null ? (
        <p className="text-muted">Đang tải lịch…</p>
      ) : records.length === 0 ? (
        <EmptyState>{t(upcomingOnly ? 'healthSchedule.emptyUpcoming' : 'healthSchedule.emptyAll')}</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left">
                  <th className={`${th} pl-5`}>{t('healthSchedule.horse')}</th>
                  <th className={th}>{t('healthSchedule.item')}</th>
                  <th className={th}>{t('healthSchedule.kind')}</th>
                  <th className={`${th} text-right`}>{t('healthSchedule.lastDate')}</th>
                  <th className={`${th} text-right`}>{t('healthSchedule.nextDue')}</th>
                  <th className={`${th} pr-5`}>{t('healthSchedule.status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                    <td className="pl-5 pr-4 py-3">{record.horse ? <Link to={`/horses/${record.horse.id}`} className="font-medium text-ink hover:text-info no-underline">{record.horse.name}</Link> : <span className="text-muted">Không rõ</span>}</td>
                    <td className="px-4 py-3">{record.vaccineName}</td>
                    <td className="px-4 py-3 text-muted">{t(`healthSchedule.kindOptions.${record.careType ?? 'VACCINATION'}`)}</td>
                    <td className="px-4 py-3 num text-right text-muted whitespace-nowrap">{formatDate(record.date)}</td>
                    <td className="px-4 py-3 num text-right whitespace-nowrap">{record.nextDueDate ? formatDate(record.nextDueDate) : <span className="text-muted">{t('healthSchedule.noDueDate')}</span>}</td>
                    <td className="pl-4 pr-5 py-3"><DueStatus date={record.nextDueDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

/** Whole days from today until the due date (negative when overdue); null when there is none. */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000);
}

function DueStatus({ date }: { date: string | null }) {
  const { t } = useTranslation();
  const d = daysUntil(date);
  if (d == null) return <Badge tone="neu">{t('healthSchedule.noDueDate')}</Badge>;
  if (d < 0) return <Badge tone="bad">{t('healthSchedule.overdue')} {-d} ngày</Badge>;
  if (d <= 14) return <Badge tone="warn">{d === 0 ? 'Đến hạn hôm nay' : `Còn ${d} ngày`}</Badge>;
  return <Badge tone="ok">{t('healthSchedule.scheduled')}</Badge>;
}

function CreateVaccinationForm({ onCreated, onClose }: { onCreated: () => Promise<void>; onClose: () => void }) {
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
          <Field label={t('healthSchedule.horse')} req>
            <NativeSelect value={horseId} onChange={(e) => setHorseId(e.target.value)} required>
              <option value="">{t('healthSchedule.selectHorse')}</option>
              {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('healthSchedule.kind')}>
            <NativeSelect value={careType} onChange={(e) => setCareType(e.target.value as 'VACCINATION' | 'DEWORMING')}>
              <option value="VACCINATION">{t('healthSchedule.kindOptions.VACCINATION')}</option>
              <option value="DEWORMING">{t('healthSchedule.kindOptions.DEWORMING')}</option>
            </NativeSelect>
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
        <div className="flex gap-2">
          <Btn v="p" type="submit" disabled={saving || horses.length === 0}>
            {saving ? t('healthSchedule.saving') : t('common.create')}
          </Btn>
          <Btn v="g" onClick={onClose}>Đóng</Btn>
        </div>
      </Card>
    </form>
  );
}
