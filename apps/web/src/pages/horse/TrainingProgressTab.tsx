import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Paginated, TrainingPlan, TrainingSession } from '../../lib/types';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';
import { Bar, Card, CardHeader, EmptyState, KpiStrip } from '../../ds/ui';
import { LineChart } from '../../ds/charts';

const WEEKS = 8;
const shortDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });

function weekStart(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

async function fetchAll<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (!signal.aborted) {
    const res = await api.get<Paginated<T>>(url, { params: { page, limit: 100 }, signal });
    all.push(...res.data.data);
    if (res.data.meta.page * res.data.meta.limit >= res.data.meta.total) break;
    page += 1;
  }
  return all;
}

export function TrainingProgressTab({ horseId }: { horseId: string }) {
  return <ProgressContent key={horseId} horseId={horseId} />;
}

function ProgressContent({ horseId }: { horseId: string }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [s, p] = await Promise.all([
          fetchAll<TrainingSession>(`/horses/${horseId}/sessions`, controller.signal),
          fetchAll<TrainingPlan>(`/horses/${horseId}/training-plans`, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setSessions(s);
          setPlans(p);
        }
      } catch (e) {
        if (!controller.signal.aborted) setErr(e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [horseId]);

  if (loading) return <p className="text-muted" role="status">Đang tải tiến độ huấn luyện…</p>;
  if (err) return <ErrorText err={err} />;

  const total = sessions.length;
  const done = sessions.filter((s) => s.status === 'DONE').length;
  const cancelled = sessions.filter((s) => s.status === 'CANCELLED').length;
  const planned = sessions.filter((s) => s.status === 'PLANNED').length;
  const decided = done + cancelled;
  const completionRate = decided > 0 ? Math.round((done / decided) * 100) : null;

  const thisWeekStart = weekStart(new Date());
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeekStart);
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7);
    return { start, count: 0 };
  });
  for (const s of sessions) {
    if (s.status !== 'DONE') continue;
    const ws = weekStart(new Date(s.scheduledAt)).getTime();
    const bucket = buckets.find((b) => b.start.getTime() === ws);
    if (bucket) bucket.count += 1;
  }
  const values = buckets.map((b) => b.count);
  const labels = buckets.map((b, i) => (i % 2 === 0 ? shortDate.format(b.start) : null));
  const maxValue = Math.max(4, ...values);
  const now = new Date().getTime();

  if (total === 0 && plans.length === 0) {
    return <EmptyState>Ngựa chưa có giáo án hay buổi tập nào — tiến độ sẽ hiện ở đây khi huấn luyện viên bắt đầu lên lịch.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-5">
      {total > 0 && <KpiStrip items={[
        { label: 'Tổng số buổi tập', value: total, sub: planned ? `${planned} buổi chưa diễn ra` : undefined },
        { label: 'Đã hoàn thành', value: done },
        { label: 'Đã hủy', value: cancelled, tone: cancelled > 0 ? 'warn' : undefined },
        { label: 'Tỷ lệ hoàn thành', value: completionRate ?? <span className="text-muted text-[16px] font-normal">Chưa có</span>, unit: completionRate != null ? '%' : undefined, lead: completionRate != null },
      ]} />}

      <Card>
        <CardHeader title="Buổi tập hoàn thành theo tuần"><span className="text-[13px] text-muted">{WEEKS} tuần gần nhất</span></CardHeader>
        <div className="px-5 pt-3 pb-4">
          {total === 0 ? (
            <EmptyState>Chưa có buổi tập nào để thống kê.</EmptyState>
          ) : (
            // A wide viewBox keeps the chart's text near its true size when the card is wide.
            <div className="max-w-[960px]">
              <LineChart
                values={values}
                labels={labels}
                min={0}
                max={maxValue}
                ticks={[0, Math.round(maxValue / 2), maxValue]}
                W={900}
                H={230}
                describe="Số buổi tập hoàn thành mỗi tuần"
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Tiến độ theo giáo án" />
        {plans.length === 0 ? (
          <div className="p-4"><EmptyState>Ngựa chưa có giáo án huấn luyện nào.</EmptyState></div>
        ) : (
          <ul className="list-none m-0 p-0">
            {plans.map((p) => {
              const start = new Date(p.startDate).getTime();
              const end = p.endDate ? new Date(p.endDate).getTime() : null;
              const pct = end != null && end > start ? Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100))) : null;
              const over = end != null && now > end;
              return (
                <li key={p.id} className="px-5 py-3.5 border-b border-line-soft last:border-0">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="font-medium min-w-0 truncate">{p.goal}</span>
                    <span className="num text-[13px] text-muted flex-none">{pct != null ? `${pct}%` : 'Dài hạn'}</span>
                  </div>
                  {pct != null && <Bar pct={pct} color={over ? '#9ca3af' : '#1a4b8a'} className="mt-2" />}
                  <p className="num text-[12.5px] text-muted mt-1.5">{formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'không giới hạn'}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
