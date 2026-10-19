import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { TrainingProgress, TrainingProgressRow } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate, formatDateTime } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Bar, Btn, Card, Chip, HeroStats, Icon, Seg, fitColor, healthTone } from '../ds/ui';

/**
 * UC-13 — View overall training progress. One row per horse, aggregated by
 * GET /training-progress (a single request, not one per horse).
 */

type Range = '30' | '90' | 'all';
type Filter = 'ALL' | 'OVERDUE' | 'NO_PLAN' | 'LOCKED';

const RANGES: [Range, string][] = [['30', '30 ngày'], ['90', '90 ngày'], ['all', 'Toàn bộ']];
const HEALTH_LABEL: Record<string, string> = { FIT: 'Khỏe mạnh', MONITORING: 'Theo dõi', INJURED: 'Chấn thương', QUARANTINED: 'Cách ly' };
const DAY_MS = 86_400_000;

const matches: Record<Filter, (r: TrainingProgressRow) => boolean> = {
  ALL: () => true,
  OVERDUE: (r) => r.sessions.overdue > 0,
  NO_PLAN: (r) => r.plans.active === 0,
  LOCKED: (r) => r.horse.locked,
};

export function TrainingProgressPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('30');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  usePageChrome({ crumbs: ['Huấn luyện', 'Tiến độ tổng quan'], search: 'Tìm theo tên ngựa, chủ sở hữu…', onSearch: setSearch });

  const { data, loading, error } = useCachedResource(`training-progress:${user?.id ?? ''}:${range}`, () =>
    api.get<TrainingProgress>('/training-progress', {
      params: range === 'all' ? {} : { from: new Date(Date.now() - Number(range) * DAY_MS).toISOString() },
    }).then((r) => r.data),
  );
  const rows = useMemo(() => data?.horses ?? [], [data]);
  const summary = data?.summary;

  const counts = useMemo(() => {
    const c = { ALL: 0, OVERDUE: 0, NO_PLAN: 0, LOCKED: 0 } satisfies Record<Filter, number>;
    for (const r of rows) for (const f of Object.keys(c) as Filter[]) if (matches[f](r)) c[f] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return rows.filter((r) => matches[filter](r) &&
      (!q || `${r.horse.name} ${r.horse.breed ?? ''} ${r.horse.owner.name}`.toLocaleLowerCase().includes(q)));
  }, [rows, filter, search]);

  const dash = loading && !data ? '…' : undefined;
  const s = summary?.sessions;

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">Huấn luyện · Racehorse Club</div>
            <h1 className="disp text-[56px] mt-2">Tiến độ huấn luyện</h1>
            <p className="text-hero-muted mt-2.5 max-w-[560px]">
              {user?.role === 'OWNER'
                ? 'Tổng quan tiến độ tập luyện của các chiến mã bạn sở hữu.'
                : 'Tổng quan buổi tập đã hoàn thành, sắp tới và quá hạn của toàn bộ chiến mã trong câu lạc bộ.'}
            </p>
          </div>
          <Seg dark options={RANGES} value={range} onChange={(k) => setRange(k as Range)} />
        </div>
        <HeroStats items={[
          { label: 'Chiến mã', value: dash ?? summary?.horses ?? 0 },
          { label: 'Có giáo án đang chạy', value: dash ?? summary?.horsesWithActivePlan ?? 0, color: '#9fd9b1' },
          { label: 'Buổi đã hoàn thành', value: dash ?? s?.done ?? 0, small: s ? `/ ${s.total - s.cancelled}` : undefined },
          { label: 'Tỷ lệ hoàn thành', value: dash ?? (summary?.completionRate ?? '—'), small: summary?.completionRate != null ? '%' : undefined },
          { label: 'Buổi quá hạn', value: dash ?? s?.overdue ?? 0, color: s?.overdue ? '#f3d29a' : undefined },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center" role="group" aria-label="Lọc chiến mã">
        <Chip on={filter === 'ALL'} onClick={() => setFilter('ALL')}>Tất cả <span className="opacity-70">{counts.ALL}</span></Chip>
        <Chip on={filter === 'OVERDUE'} onClick={() => setFilter('OVERDUE')}>Có buổi quá hạn <span className="opacity-70">{counts.OVERDUE}</span></Chip>
        <Chip on={filter === 'NO_PLAN'} onClick={() => setFilter('NO_PLAN')}>Chưa có giáo án đang chạy <span className="opacity-70">{counts.NO_PLAN}</span></Chip>
        <Chip on={filter === 'LOCKED'} onClick={() => setFilter('LOCKED')}>Đang khóa tập <span className="opacity-70">{counts.LOCKED}</span></Chip>
        <span className="cap ml-auto">Tỷ lệ hoàn thành = buổi đã xong / buổi không bị hủy trong khoảng thời gian đã chọn.</span>
      </div>

      {loading && !data ? (
        <p className="cap">Đang tải tiến độ huấn luyện…</p>
      ) : error ? (
        <ErrorText err={error} />
      ) : visible.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="reports" className="w-7 h-7 text-muted" />
          <p className="cap">{rows.length === 0 ? 'Chưa có chiến mã nào để theo dõi tiến độ.' : 'Không có chiến mã nào phù hợp với bộ lọc.'}</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="text-left">
                  {['Chiến mã', 'Sức khỏe', 'Giáo án', 'Tiến độ buổi tập', 'Quá hạn', 'Buổi gần nhất', 'Buổi kế tiếp', ''].map((th, i) => (
                    <th key={i} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => <ProgressRow key={r.horse.id} row={r} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function ProgressRow({ row }: { row: TrainingProgressRow }) {
  const { horse, plans, sessions, completionRate, lastSession, nextSession } = row;
  const base = sessions.total - sessions.cancelled;
  return (
    <tr className="border-b border-line-soft hover:bg-subtle align-top">
      <td className="px-4 py-3">
        <Link to={`/horses/${horse.id}`} className="font-semibold text-navy no-underline">
          {horse.saddleNumber != null && <span className="text-muted mr-1">#{horse.saddleNumber}</span>}{horse.name}
        </Link>
        <div className="cap">{[horse.breed, horse.owner.name].filter(Boolean).join(' · ')}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge tone={healthTone[horse.healthStatus]}>{HEALTH_LABEL[horse.healthStatus] ?? horse.healthStatus}</Badge>
          {horse.locked && <Badge tone="lock"><Icon name="lock" className="w-3 h-3" />Khóa tập</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        {plans.active > 0
          ? <Badge tone="ok">{plans.active} đang chạy</Badge>
          : <Badge tone="neu">Không có</Badge>}
        <div className="cap mt-1">Tổng {plans.total} giáo án</div>
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Bar pct={completionRate ?? 0} color={fitColor(completionRate)} className="w-28" />
          <b className="num text-[13px]" style={{ color: fitColor(completionRate) }}>{completionRate != null ? `${completionRate}%` : '—'}</b>
        </div>
        <div className="cap mt-1">
          {sessions.done}/{base} đã xong · {sessions.planned} chờ{sessions.cancelled > 0 ? ` · ${sessions.cancelled} hủy` : ''}
        </div>
      </td>
      <td className="px-4 py-3">
        {sessions.overdue > 0 ? <Badge tone="warn"><Icon name="clock" className="w-3 h-3" />{sessions.overdue} buổi</Badge> : <span className="cap">—</span>}
      </td>
      <td className="px-4 py-3">
        {lastSession ? (
          <>
            <div className="text-[13px]">{formatDate(lastSession.scheduledAt)} · {lastSession.type}</div>
            {(lastSession.resultMetric || lastSession.resultValue != null) && (
              <div className="cap">{lastSession.resultMetric ?? '—'} = {lastSession.resultValue ?? '—'}</div>
            )}
          </>
        ) : <span className="cap">Chưa có</span>}
      </td>
      <td className="px-4 py-3">
        {nextSession ? (
          <>
            <div className="text-[13px]">{formatDateTime(nextSession.scheduledAt)}</div>
            <div className="cap">{nextSession.type}</div>
          </>
        ) : <span className="cap">Chưa lên lịch</span>}
      </td>
      <td className="px-4 py-3 text-right"><Btn sm to={`/horses/${horse.id}?tab=sessions`}>Buổi tập ›</Btn></td>
    </tr>
  );
}
