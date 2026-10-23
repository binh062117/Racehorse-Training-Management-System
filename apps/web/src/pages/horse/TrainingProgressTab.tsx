import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Paginated, TrainingPlan, TrainingSession } from '../../lib/types';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';
import { Bar, Card } from '../../ds/ui';
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

  if (loading) return <p className="cap" role="status">Đang tải tiến độ huấn luyện…</p>;
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

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Tổng số buổi tập', total],
          ['Đã hoàn thành', done],
          ['Đã hủy', cancelled],
          ['Tỷ lệ hoàn thành', completionRate != null ? `${completionRate}%` : '—'],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <span className="cap">{label}</span>
            <div className="num font-bold text-xl mt-0.5">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold mb-1">Buổi tập hoàn thành theo tuần</h3>
        <p className="cap mb-3">{WEEKS} tuần gần nhất · còn {planned} buổi đã lên lịch chưa diễn ra</p>
        {total === 0 ? (
          <p className="cap">Chưa có buổi tập nào để thống kê.</p>
        ) : (
          <LineChart
            values={values}
            labels={labels}
            min={0}
            max={maxValue}
            ticks={[0, Math.round(maxValue / 2), maxValue]}
            color="#1a4b8a"
            describe="Số buổi tập hoàn thành mỗi tuần"
          />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold mb-3">Tiến độ theo giáo án</h3>
        {plans.length === 0 ? (
          <p className="cap">Chiến mã chưa có giáo án huấn luyện nào.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {plans.map((p) => {
              const start = new Date(p.startDate).getTime();
              const end = p.endDate ? new Date(p.endDate).getTime() : null;
              const pct = end != null && end > start ? Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100))) : null;
              return (
                <div key={p.id}>
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="font-medium truncate">{p.goal}</span>
                    <span className="cap num flex-none">{pct != null ? `${pct}%` : 'Không giới hạn'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Bar pct={pct ?? (now >= start ? 100 : 0)} color="#1a4b8a" className="flex-1" />
                  </div>
                  <p className="cap mt-1">{formatDate(p.startDate)} — {p.endDate ? formatDate(p.endDate) : 'không giới hạn'}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
