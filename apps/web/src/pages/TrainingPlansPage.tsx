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
import { Badge, Btn, Card, Chip, HeroStats, Icon } from '../ds/ui';

export function TrainingPlansPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
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

  usePageChrome({ crumbs: ['Huấn luyện', 'Giáo án'], search: 'Tìm theo tên ngựa, mục tiêu, HLV…', onSearch: setSearch });

  const now = new Date();
  const totalCount = plans.length;
  const activeCount = plans.filter((p) => !p.endDate || new Date(p.endDate).getTime() >= now.getTime()).length;
  const completedCount = plans.filter((p) => p.endDate && new Date(p.endDate).getTime() < now.getTime()).length;
  const uniqueHorsesCount = new Set(plans.map((p) => p.horseId)).size;

  const filteredPlans = plans.filter((p) => {
    const isOngoing = !p.endDate || new Date(p.endDate).getTime() >= now.getTime();
    if (statusFilter === 'ACTIVE' && !isOngoing) return false;
    if (statusFilter === 'COMPLETED' && isOngoing) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchHorse = p.horse?.name?.toLowerCase().includes(q);
      const matchGoal = p.goal.toLowerCase().includes(q);
      const matchTrainer = p.trainer?.name?.toLowerCase().includes(q);
      if (!matchHorse && !matchGoal && !matchTrainer) return false;
    }
    return true;
  });

  const subtitle = {
    TRAINER: 'Lập giáo án chi tiết (cự ly, khối lượng, mặt sân) theo từng giai đoạn cho từng chiến mã.',
    MANAGER: 'Theo dõi tổng quan tiến độ giáo án huấn luyện của toàn bộ câu lạc bộ.',
    OWNER: 'Xem lịch trình và giáo án huấn luyện của các chiến mã thuộc sở hữu.',
  }[role ?? ''] ?? 'Theo dõi giáo án huấn luyện.';

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">Mùa giải 2026 · Racehorse Club</div>
            <h1 className="disp text-[56px] mt-2">Giáo án huấn luyện</h1>
            <p className="text-hero-muted mt-2.5 max-w-[520px]">{subtitle}</p>
          </div>
          {canCreate && (
            <Btn v="light" onClick={() => setCreateOpen(true)}><Icon name="plus" />Tạo giáo án mới</Btn>
          )}
        </div>
        <HeroStats items={[
          { label: 'Tổng số giáo án', value: totalCount },
          { label: 'Đang triển khai', value: activeCount, color: '#9fd9b1' },
          { label: 'Đã hoàn thành', value: completedCount },
          { label: 'Chiến mã có giáo án', value: uniqueHorsesCount },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        <Chip on={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>Tất cả <span className="text-muted">{totalCount}</span></Chip>
        <Chip on={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')}>Đang áp dụng <span className="text-muted">{activeCount}</span></Chip>
        <Chip on={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')}>Đã kết thúc <span className="text-muted">{completedCount}</span></Chip>
      </div>

      {loading && plans.length === 0 ? (
        <p className="cap">Đang tải danh sách giáo án huấn luyện…</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : filteredPlans.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="plans" className="w-7 h-7 text-muted" />
          <p className="cap">{plans.length === 0 ? 'Chưa có kế hoạch huấn luyện nào được thiết lập.' : 'Không tìm thấy giáo án nào phù hợp với bộ lọc.'}</p>
          {canCreate && plans.length === 0 && (
            <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />Tạo giáo án đầu tiên</Btn>
          )}
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="text-left">
                  {['Chiến mã', 'Mục tiêu giáo án', 'HLV phụ trách', 'Thời gian', 'Trạng thái', ''].map((t) => (
                    <th key={t} className="h-[42px] px-4 bg-cream lbl border-b border-line">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const isOngoing = !plan.endDate || new Date(plan.endDate).getTime() >= now.getTime();
                  return (
                    <tr key={plan.id} className="border-b border-line-soft hover:bg-subtle">
                      <td className="px-4 py-3">
                        <Link to={`/horses/${plan.horseId}`} className="font-semibold text-navy no-underline">{plan.horse?.name ?? '—'}</Link>
                        {plan.horse?.breed && <div className="cap">{plan.horse.breed}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[360px]">{plan.goal}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{plan.trainer?.name ?? '—'}</div>
                        <div className="cap">{plan.trainer?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px]">{formatDate(plan.startDate)}</div>
                        <div className="cap">đến {plan.endDate ? formatDate(plan.endDate) : 'Dài hạn'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isOngoing ? <Badge tone="ok"><Icon name="check" className="w-3.5 h-3.5" />Đang áp dụng</Badge> : <Badge tone="neu">Đã hoàn thành</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right"><Btn sm to={`/horses/${plan.horseId}`}>Hồ sơ ngựa ›</Btn></td>
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
