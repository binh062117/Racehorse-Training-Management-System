import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Paginated, TrainingPlan } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { PlusIcon, PlanIcon, CheckIcon } from '../components/Icons';
import { CreateTrainingPlanModal } from '../components/training/CreateTrainingPlanModal';

export function TrainingPlansPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);

  // Automatically open modal if URL has ?action=create
  useEffect(() => {
    if (searchParams.get('action') === 'create' && canCreate) {
      setCreateOpen(true);
      // Clean query param
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canCreate]);

  const {
    data,
    loading,
    error: loadErr,
    reload: loadPlans,
  } = useCachedResource('training-plans', () =>
    api
      .get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 100 } })
      .then((r) => r.data),
  );
  const plans = data?.data ?? [];

  const now = new Date();

  // Metrics
  const totalCount = plans.length;
  const activeCount = plans.filter(
    (p) => !p.endDate || new Date(p.endDate).getTime() >= now.getTime(),
  ).length;
  const completedCount = plans.filter(
    (p) => p.endDate && new Date(p.endDate).getTime() < now.getTime(),
  ).length;
  const uniqueHorsesCount = new Set(plans.map((p) => p.horseId)).size;

  // Filtered list
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

  return (
    <div className="stack">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Kế hoạch &amp; Giáo án Huấn luyện</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {role === 'TRAINER' && 'Lập giáo án chi tiết (cự ly, khối lượng, mặt sân) theo từng giai đoạn cho từng chiến mã.'}
            {role === 'MANAGER' && 'Theo dõi tổng quan tiến độ giáo án huấn luyện của toàn bộ câu lạc bộ.'}
            {role === 'OWNER' && 'Xem lịch trình và giáo án huấn luyện của các chiến mã thuộc sở hữu.'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon /> Tạo giáo án mới
          </button>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : totalCount}</div>
          <div className="k-label">Tổng số giáo án</div>
        </div>

        <div className="kpi-tile ok">
          <div className="k-num">{loading ? '…' : activeCount}</div>
          <div className="k-label">Đang triển khai</div>
        </div>

        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : completedCount}</div>
          <div className="k-label">Đã hoàn thành</div>
        </div>

        <div className="kpi-tile">
          <div className="k-num">{loading ? '…' : uniqueHorsesCount}</div>
          <div className="k-label">Chiến mã có giáo án</div>
        </div>
      </div>

      {/* Toolbar: Search & Status Filters */}
      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Tìm theo tên ngựa, mục tiêu, hoặc HLV..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            className={`chip ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Đang áp dụng ({activeCount})
          </button>
          <button
            type="button"
            className={`chip ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('COMPLETED')}
          >
            Đã kết thúc ({completedCount})
          </button>
        </div>
      </div>

      {/* Table / List */}
      {loading && plans.length === 0 ? (
        <p className="muted">Đang tải danh sách giáo án huấn luyện…</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : filteredPlans.length === 0 ? (
        <div className="card center" style={{ padding: '48px 20px' }}>
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--surface-subtle)', marginBottom: 12 }}>
            <PlanIcon width="28" height="28" />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
            {plans.length === 0
              ? 'Chưa có kế hoạch huấn luyện nào được thiết lập.'
              : 'Không tìm thấy giáo án nào phù hợp với bộ lọc.'}
          </p>
          {canCreate && plans.length === 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon /> Tạo giáo án đầu tiên
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Chiến mã</th>
                <th>Mục tiêu giáo án</th>
                <th>HLV phụ trách</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => {
                const isOngoing =
                  !plan.endDate || new Date(plan.endDate).getTime() >= now.getTime();

                return (
                  <tr key={plan.id}>
                    <td>
                      <div>
                        <Link
                          to={`/horses/${plan.horseId}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                          }}
                        >
                          {plan.horse?.name ?? '—'}
                        </Link>
                        {plan.horse?.breed && (
                          <div className="muted" style={{ fontSize: '12px' }}>
                            {plan.horse.breed}
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 500, maxWidth: 360 }}>
                        {plan.goal}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {plan.trainer?.name ?? '—'}
                      </div>
                      <div className="muted" style={{ fontSize: '12px' }}>
                        {plan.trainer?.email}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '13px' }}>
                        {formatDate(plan.startDate)}
                      </div>
                      <div className="muted" style={{ fontSize: '12px' }}>
                        đến {plan.endDate ? formatDate(plan.endDate) : 'Dài hạn'}
                      </div>
                    </td>

                    <td>
                      {isOngoing ? (
                        <span
                          className="badge badge-success"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckIcon /> Đang áp dụng
                        </span>
                      ) : (
                        <span className="badge badge-neutral">Đã hoàn thành</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/horses/${plan.horseId}`}
                        className="btn btn-sm btn-ghost"
                      >
                        Hồ sơ ngựa ›
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal create plan */}
      <CreateTrainingPlanModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void loadPlans();
        }}
      />
    </div>
  );
}
