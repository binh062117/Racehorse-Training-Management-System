import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Paginated, TrainingPlan } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { PlanProgressCell, PlanStateBadge, planState } from '../components/training/PlanProgress';
import { CreateTrainingPlanModal } from '../components/training/CreateTrainingPlanModal';
import { usePageChrome } from '../ds/AppShell';
import { Btn, Card, Chip, ChipCount, EmptyState, Icon, PageHeader, Pagination } from '../ds/ui';

type Filter = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED';


export function TrainingPlansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>(() => { const s = searchParams.get('status'); return s === 'ACTIVE' || s === 'OVERDUE' || s === 'COMPLETED' ? s : 'ALL'; });
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
    api.get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 100 } }).then((r) => r.data),
  );
  const plans = data?.data ?? [];

  usePageChrome({ crumbs: [t('plansPage.title', 'Giáo án huấn luyện')] });

  // Progress is measured by sessions (complete = every session DONE), not by the calendar.
  const isOngoing = (p: TrainingPlan) => planState(p) !== 'COMPLETE';
  const activeCount = plans.filter((p) => planState(p) === 'ACTIVE').length;
  const overdueCount = plans.filter((p) => planState(p) === 'OVERDUE').length;
  const completedCount = plans.filter((p) => planState(p) === 'COMPLETE').length;
  const horsesOnPlan = new Set(plans.filter(isOngoing).map((p) => p.horseId)).size;

  const q = search.trim().toLowerCase();
  const filteredPlans = plans.filter((p) => {
    if (statusFilter === 'ACTIVE' && planState(p) !== 'ACTIVE') return false;
    if (statusFilter === 'OVERDUE' && planState(p) !== 'OVERDUE') return false;
    if (statusFilter === 'COMPLETED' && planState(p) !== 'COMPLETE') return false;
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
      : t('planProgress.sub', { active: activeCount, horses: horsesOnPlan, overdue: overdueCount, done: completedCount });

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
        <Chip on={statusFilter === 'OVERDUE'} onClick={() => { setStatusFilter('OVERDUE'); setPage(1); }}>{t('planProgress.overdue')} <ChipCount n={overdueCount} /></Chip>
        <Chip on={statusFilter === 'COMPLETED'} onClick={() => { setStatusFilter('COMPLETED'); setPage(1); }}>{t('planProgress.complete')} <ChipCount n={completedCount} /></Chip>
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
                      <td className="px-4 py-3"><PlanProgressCell plan={plan} /></td>
                      <td className="px-5 py-3"><PlanStateBadge plan={plan} /></td>
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
