import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Paginated, TrainingPlan } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { CreateTrainingPlanModal } from '../components/training/CreateTrainingPlanModal';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Bar, Btn, Card, Chip, ChipCount, EmptyState, Icon, PageHeader } from '../ds/ui';

type Filter = 'ALL' | 'ACTIVE' | 'COMPLETED';

/** Share of the plan's window already elapsed, at the true ratio; null for open-ended plans. */
function elapsed(plan: TrainingPlan, now: number): number | null {
  if (!plan.endDate) return null;
  const start = new Date(plan.startDate).getTime();
  const end = new Date(plan.endDate).getTime();
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

export function TrainingPlansPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && canCreate) {
      setCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canCreate]);

  const { data, loading, error: loadErr, reload: loadPlans } = useCachedResource('training-plans', () =>
    api.get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 100 } }).then((r) => r.data),
  );
  const plans = data?.data ?? [];

  usePageChrome({ crumbs: ['Giáo án huấn luyện'] });

  const now = new Date().getTime();
  const isOngoing = (p: TrainingPlan) => !p.endDate || new Date(p.endDate).getTime() >= now;
  const activeCount = plans.filter(isOngoing).length;
  const completedCount = plans.length - activeCount;
  const horsesOnPlan = new Set(plans.filter(isOngoing).map((p) => p.horseId)).size;

  const q = search.trim().toLowerCase();
  const filteredPlans = plans.filter((p) => {
    if (statusFilter === 'ACTIVE' && !isOngoing(p)) return false;
    if (statusFilter === 'COMPLETED' && isOngoing(p)) return false;
    if (q) {
      return Boolean(p.horse?.name?.toLowerCase().includes(q) || p.goal.toLowerCase().includes(q) || p.trainer?.name?.toLowerCase().includes(q));
    }
    return true;
  });

  const sub = loading && plans.length === 0
    ? 'Đang tải giáo án…'
    : plans.length === 0
      ? 'Chưa có giáo án nào.'
      : `${activeCount} giáo án đang áp dụng cho ${horsesOnPlan} ngựa · ${completedCount} đã kết thúc.`;

  return (
    <>
      <PageHeader
        title="Giáo án huấn luyện"
        sub={sub}
        search={{ placeholder: 'Tìm ngựa, mục tiêu, huấn luyện viên', value: search, onChange: setSearch }}
        actions={canCreate ? <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />Tạo giáo án</Btn> : undefined}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Chip on={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>Tất cả <ChipCount n={plans.length} /></Chip>
        <Chip on={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')}>Đang áp dụng <ChipCount n={activeCount} /></Chip>
        <Chip on={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')}>Đã kết thúc <ChipCount n={completedCount} /></Chip>
      </div>

      {loading && plans.length === 0 ? (
        <p className="text-muted">Đang tải giáo án…</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : filteredPlans.length === 0 ? (
        <EmptyState action={canCreate && plans.length === 0 ? <Btn sm v="p" onClick={() => setCreateOpen(true)}>Tạo giáo án đầu tiên</Btn> : undefined}>
          {plans.length === 0 ? 'Chưa có giáo án huấn luyện nào.' : 'Không có giáo án nào khớp với bộ lọc.'}
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-10 px-5 font-medium border-b border-line w-[18%]">Ngựa</th>
                  <th className="h-10 px-4 font-medium border-b border-line">Mục tiêu</th>
                  <th className="h-10 px-4 font-medium border-b border-line">Huấn luyện viên</th>
                  <th className="h-10 px-4 font-medium border-b border-line">Thời gian</th>
                  <th className="h-10 px-4 font-medium border-b border-line w-[180px]">Tiến độ</th>
                  <th className="h-10 px-5 font-medium border-b border-line">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const ongoing = isOngoing(plan);
                  const pct = elapsed(plan, now);
                  return (
                    <tr key={plan.id} className="border-b border-line-soft last:border-0 hover:bg-subtle align-top">
                      <td className="px-5 py-3">
                        <Link to={`/horses/${plan.horseId}?tab=plans`} className="font-medium text-ink no-underline hover:text-info">{plan.horse?.name ?? '—'}</Link>
                        {plan.horse?.breed && <div className="text-[12.5px] text-muted">{plan.horse.breed}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[380px]">{plan.goal}</td>
                      <td className="px-4 py-3">{plan.trainer?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap num">
                        <div>{formatDate(plan.startDate)}</div>
                        <div className="text-[12.5px] text-muted">đến {plan.endDate ? formatDate(plan.endDate) : 'không giới hạn'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {pct == null ? (
                          <span className="text-[13px] text-muted">Dài hạn</span>
                        ) : (
                          <div className="flex items-center gap-2.5 pt-1.5">
                            <Bar pct={pct} color={ongoing ? '#1a4b8a' : '#9ca3af'} className="flex-1" />
                            <span className="num text-[12.5px] text-muted w-9 text-right">{pct}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {ongoing ? <Badge tone="ok">Đang áp dụng</Badge> : <Badge tone="neu">Đã kết thúc</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateTrainingPlanModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void loadPlans()} />
    </>
  );
}
