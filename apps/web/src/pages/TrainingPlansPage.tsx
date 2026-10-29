import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Paginated, TrainingPlan } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { CreateTrainingPlanModal } from '../components/training/CreateTrainingPlanModal';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Bar, Btn, Card, Chip, ChipCount, EmptyState, Icon, PageHeader, Pagination } from '../ds/ui';

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && canCreate) {
      setCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canCreate]);

  const { data, loading, error: loadErr, reload: loadPlans } = useCachedResource('training-plans', () =>
    api.get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 500 } }).then((r) => r.data),
  );
  const plans = data?.data ?? [];

  usePageChrome({ crumbs: [t('plansPage.title', 'Giáo án huấn luyện')] });

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

  const totalPages = Math.ceil(filteredPlans.length / pageSize) || 1;
  const paginatedPlans = filteredPlans.slice((page - 1) * pageSize, page * pageSize);

  const sub = loading && plans.length === 0
    ? t('plansPage.loading', 'Đang tải giáo án…')
    : plans.length === 0
      ? t('plansPage.empty', 'Chưa có giáo án nào.')
      : `${activeCount} ${t('plansPage.active', 'đang áp dụng')} (${horsesOnPlan} ${t('horsesPage.title', 'ngựa')}) · ${completedCount} ${t('plansPage.completed', 'đã kết thúc')}.`;

  return (
    <>
      <PageHeader
        title={t('plansPage.title', 'Giáo án huấn luyện')}
        sub={sub}
        search={{ placeholder: t('plansPage.searchPlaceholder', 'Tìm theo mục tiêu, tên ngựa'), value: search, onChange: (val) => { setSearch(val); setPage(1); } }}
        actions={canCreate ? <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />{t('plansPage.newPlan', 'Tạo giáo án')}</Btn> : undefined}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Chip on={statusFilter === 'ALL'} onClick={() => { setStatusFilter('ALL'); setPage(1); }}>{t('plansPage.all', 'Tất cả')} <ChipCount n={plans.length} /></Chip>
        <Chip on={statusFilter === 'ACTIVE'} onClick={() => { setStatusFilter('ACTIVE'); setPage(1); }}>{t('plansPage.active', 'Đang áp dụng')} <ChipCount n={activeCount} /></Chip>
        <Chip on={statusFilter === 'COMPLETED'} onClick={() => { setStatusFilter('COMPLETED'); setPage(1); }}>{t('plansPage.completed', 'Đã kết thúc')} <ChipCount n={completedCount} /></Chip>
      </div>

      {loading && plans.length === 0 ? (
        <p className="text-muted">{t('plansPage.loading', 'Đang tải giáo án…')}</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : filteredPlans.length === 0 ? (
        <EmptyState action={canCreate && plans.length === 0 ? <Btn sm v="p" onClick={() => setCreateOpen(true)}>{t('plansPage.newPlan', 'Tạo giáo án')}</Btn> : undefined}>
          {plans.length === 0 ? t('plansPage.empty', 'Chưa có giáo án huấn luyện nào.') : t('plansPage.emptyFilter', 'Không có giáo án nào khớp với bộ lọc.')}
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-10 px-5 font-medium border-b border-line w-[18%]">{t('plansPage.colHorse', 'Ngựa')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('plansPage.colGoal', 'Mục tiêu')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('plansPage.colTrainer', 'Huấn luyện viên')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('plansPage.colTime', 'Thời gian')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line w-[180px]">{t('plansPage.colProgress', 'Tiến độ')}</th>
                  <th className="h-10 px-5 font-medium border-b border-line">{t('horse.status', 'Trạng thái')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlans.map((plan) => {
                  const ongoing = isOngoing(plan);
                  const pct = elapsed(plan, now);
                  return (
                    <tr key={plan.id} className="border-b border-line-soft last:border-0 hover:bg-subtle align-top">
                      <td className="px-5 py-3">
                        <Link to={`/horses/${plan.horseId}?tab=plans`} className="font-medium text-ink no-underline hover:text-info">{plan.horse?.name ?? '—'}</Link>
                        {plan.horse?.breed && <div className="text-[12.5px] text-muted">{plan.horse.breed}</div>}
                      </td>
                      {/* User-entered goal is preserved as-is */}
                      <td className="px-4 py-3 max-w-[380px]">{plan.goal}</td>
                      <td className="px-4 py-3">{plan.trainer?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap num">
                        <div>{formatDate(plan.startDate)}</div>
                        <div className="text-[12.5px] text-muted">
                          {plan.endDate ? `${t('common.to', 'đến')} ${formatDate(plan.endDate)}` : t('plansPage.openEnded', 'không giới hạn')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {pct == null ? (
                          <span className="text-[13px] text-muted">{t('plansPage.openEnded', 'Dài hạn')}</span>
                        ) : (
                          <div className="flex items-center gap-2.5 pt-1.5">
                            <Bar pct={pct} color={ongoing ? '#1a4b8a' : '#9ca3af'} className="flex-1" />
                            <span className="num text-[12.5px] text-muted w-9 text-right">{pct}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {ongoing ? (
                          <Badge tone="ok">{t('plansPage.active', 'Đang áp dụng')}</Badge>
                        ) : (
                          <Badge tone="neu">{t('plansPage.completed', 'Đã kết thúc')}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filteredPlans.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 15, 25, 50]}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        </Card>
      )}

      <CreateTrainingPlanModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void loadPlans()} />
    </>
  );
}
