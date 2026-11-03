import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { DailyCareLog, DailyCareTask, Horse, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Bar, Btn, Card, Chip, ChipCount, Cloth, EmptyState, Field, HorseAvatar, Icon, Input, KpiStrip, NativeSelect, PageHeader } from '../ds/ui';
import { getFileUrl } from '../lib/api';
import { ErrorText } from '../components/ErrorText';

const TASKS: DailyCareTask[] = ['FEEDING', 'CLEANING', 'BATHING', 'ICE_SOAK', 'HEALTH_CHECK'];
const TASK_ICON: Record<DailyCareTask, string> = { FEEDING: 'box', CLEANING: 'check', BATHING: 'user', ICE_SOAK: 'live', HEALTH_CHECK: 'steth' };
const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

/**
 * Daily stable checklist (Tân): five standard tasks per horse per day.
 * Grooms tick tasks off; the manager or a groom creates the day's checklist.
 */
export function DailyCarePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  usePageChrome({ crumbs: [t('dailyCare.title')] });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<DailyCareLog[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState('');
  const [taskType, setTaskType] = useState<DailyCareTask | ''>('');
  const [status, setStatus] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  // API rules: generate = GROOM / MANAGER; tick = GROOM / MANAGER / TRAINER.
  const canGenerate = user?.role === 'GROOM' || user?.role === 'MANAGER';
  const canTick = canGenerate || user?.role === 'TRAINER';

  useEffect(() => {
    api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } }).then((r) => setHorses(r.data.data)).catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, unknown> = { date, limit: 100 };
      if (horseId) params.horseId = horseId;
      if (taskType) params.taskType = taskType;
      if (status === 'DONE') params.completed = true;
      if (status === 'PENDING') params.completed = false;
      const res = await api.get<Paginated<DailyCareLog>>('/daily-care', { params });
      setTasks(res.data.data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [date, horseId, taskType, status]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const generate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      await api.post('/daily-care/generate', { date, ...(horseId ? { horseId } : {}) });
      await loadTasks();
    } catch (e) {
      setErr(e);
    } finally {
      setGenerating(false);
    }
  };

  const toggle = async (id: string) => {
    // Tick at once; reload if the server disagrees.
    setTasks((prev) => prev.map((x) => (x.id === id
      ? { ...x, completed: !x.completed, completedAt: !x.completed ? new Date().toISOString() : null, groom: user ? { id: user.id, name: user.name, email: user.email } : x.groom }
      : x)));
    try {
      await api.patch(`/daily-care/${id}/toggle`);
    } catch (e) {
      setErr(e);
      void loadTasks();
    }
  };

  const total = tasks.length;
  const done = tasks.filter((x) => x.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const grouped = Object.values(tasks.reduce<Record<string, DailyCareLog[]>>((acc, x) => {
    (acc[x.horseId] ??= []).push(x);
    return acc;
  }, {}));
  const horseOf = (id: string) => horses.find((h) => h.id === id);
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={t('dailyCare.title')}
        sub={loading && total === 0 ? t('dailyCare.loading') : total === 0 ? t('dailyCare.subEmpty') : t('dailyCare.sub', { done, total, horses: grouped.length })}
        actions={canGenerate ? (
          <Btn v="p" disabled={generating} onClick={() => void generate()}>
            <Icon name="plus" />{generating ? t('dailyCare.generating') : t('dailyCare.generate')}
          </Btn>
        ) : undefined}
      />

      <KpiStrip items={[
        { label: t('dailyCare.kpiTotal'), value: total },
        { label: t('dailyCare.kpiDone'), value: done, tone: done > 0 ? 'ok' : undefined },
        { label: t('dailyCare.kpiPending'), value: total - done, tone: total - done > 0 ? 'warn' : undefined },
        { label: t('dailyCare.kpiProgress'), value: pct, unit: '%', lead: true },
      ]} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('dailyCare.date')} className="w-[170px]">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('dailyCare.horse')} className="w-[220px]">
          <NativeSelect value={horseId} onChange={(e) => setHorseId(e.target.value)}>
            <option value="">{t('dailyCare.allHorses')}</option>
            {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('dailyCare.task')} className="w-[220px]">
          <NativeSelect value={taskType} onChange={(e) => setTaskType(e.target.value as DailyCareTask | '')}>
            <option value="">{t('dailyCare.allTasks')}</option>
            {TASKS.map((k) => <option key={k} value={k}>{t(`dailyCare.tasks.${k}.label`)}</option>)}
          </NativeSelect>
        </Field>
        <div className="flex gap-2 pb-0.5">
          {(['ALL', 'PENDING', 'DONE'] as const).map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {t(`dailyCare.status.${s}`)}
              {s !== 'ALL' && <ChipCount n={s === 'DONE' ? done : total - done} />}
            </Chip>
          ))}
        </div>
      </div>

      <ErrorText err={err} />

      {loading && total === 0 ? (
        <p className="text-muted">{t('dailyCare.loading')}</p>
      ) : total === 0 ? (
        <EmptyState action={canGenerate ? <Btn sm v="p" disabled={generating} onClick={() => void generate()}>{t('dailyCare.generate')}</Btn> : undefined}>
          {isToday ? t('dailyCare.emptyToday') : t('dailyCare.emptyDay', { date })}
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {grouped.map((list) => {
            const first = list[0];
            const h = horseOf(first.horseId);
            const hDone = list.filter((x) => x.completed).length;
            return (
              <Card key={first.horseId}>
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line-soft">
                  <HorseAvatar src={getFileUrl(h?.photoUrl ?? null)} name={first.horse?.name ?? ''} size={32} />
                  <Link to={`/horses/${first.horseId}`} className="font-semibold text-ink no-underline hover:text-info">{first.horse?.name}</Link>
                  <Cloth n={h?.saddleNumber} />
                  <span className="flex-1" />
                  <span className={`num text-[13px] ${hDone === list.length ? 'text-ok font-medium' : 'text-muted'}`}>{hDone}/{list.length}</span>
                  <Bar pct={Math.round((hDone / list.length) * 100)} color={hDone === list.length ? '#247b50' : '#1a4b8a'} className="w-16" />
                </div>
                <ul className="list-none m-0 p-0">
                  {list.map((x) => (
                    <li key={x.id}>
                      <label className={`flex items-start gap-3 px-5 py-3 border-b border-line-soft last:border-0 ${canTick ? 'cursor-pointer hover:bg-subtle' : ''}`}>
                        <input type="checkbox" className="mt-1 w-4 h-4 accent-[#247b50]" checked={x.completed} disabled={!canTick} onChange={() => void toggle(x.id)} />
                        <span className={`mt-0.5 ${x.completed ? 'text-ok' : 'text-muted'}`}><Icon name={TASK_ICON[x.taskType]} className="w-4 h-4" /></span>
                        <span className="flex-1 min-w-0">
                          <span className={`block font-medium ${x.completed ? 'text-muted line-through decoration-line-strong' : ''}`}>{t(`dailyCare.tasks.${x.taskType}.label`)}</span>
                          <span className="block text-[12.5px] text-muted">{x.notes || t(`dailyCare.tasks.${x.taskType}.desc`)}</span>
                        </span>
                        {x.completed && x.completedAt && (
                          <span className="text-[12px] text-muted text-right whitespace-nowrap">
                            <span className="num">{timeFmt.format(new Date(x.completedAt))}</span>
                            {x.groom && <span className="block">{x.groom.name}</span>}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
