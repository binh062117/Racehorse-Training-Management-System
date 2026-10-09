import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';
import { PlusIcon, PlanIcon, CheckIcon, AlertIcon } from '../../components/Icons';
import { CreateTrainingPlanModal } from '../../components/training/CreateTrainingPlanModal';

interface Props {
  horse: Horse;
}

export function PlansTab({ horse }: Props) {
  const { user } = useAuth();
  const canCreate = user?.role === 'TRAINER';

  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const isEligible =
    horse.status !== 'RETIRED' && horse.healthStatus !== 'QUARANTINED';

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Paginated<TrainingPlan>>(
        `/horses/${horse.id}/training-plans`,
      );
      setPlans(res.data.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const now = new Date();

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Business Rule Alerts */}
      {horse.status === 'RETIRED' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'var(--surface-subtle)',
            borderRadius: 6,
            borderLeft: '4px solid var(--text-muted)',
            fontSize: '13px',
          }}
        >
          <AlertIcon width="18" height="18" />
          <div>
            Chiến mã <strong>{horse.name}</strong> đã giải nghệ (RETIRED). Hệ thống không hỗ trợ lập giáo án huấn luyện mới.
          </div>
        </div>
      )}

      {horse.healthStatus === 'QUARANTINED' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'var(--status-danger-bg)',
            borderRadius: 6,
            borderLeft: '4px solid var(--status-danger)',
            fontSize: '13px',
            color: 'var(--status-danger)',
          }}
        >
          <AlertIcon width="18" height="18" />
          <div>
            Chiến mã đang trong diện <strong>Cách ly y tế (QUARANTINED)</strong>. Cần chờ Bác sĩ thú y gỡ cách ly trước khi lên giáo án huấn luyện.
          </div>
        </div>
      )}

      {/* Tab Header & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Giáo án &amp; Kế hoạch Huấn luyện</h3>
          <p className="muted small" style={{ marginTop: 2 }}>
            Mục tiêu huấn luyện và phân kỳ bài tập cho {horse.name}.
            {horse.fitnessScore != null && (
              <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--brand-blue)' }}>
                · Thể lực hiện tại: {horse.fitnessScore}/100
              </span>
            )}
          </p>
        </div>

        {canCreate && isEligible && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon /> Tạo giáo án mới
          </button>
        )}
      </div>

      <ErrorText err={err} />

      {loading && plans.length === 0 ? (
        <p className="muted small">Đang tải kế hoạch huấn luyện…</p>
      ) : plans.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <PlanIcon width="24" height="24" />
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Chiến mã này chưa có kế hoạch huấn luyện nào.
          </p>
          {canCreate && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon /> Thiết lập giáo án đầu tiên
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {plans.map((p) => {
            const isOngoing =
              !p.endDate || new Date(p.endDate).getTime() >= now.getTime();

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: isOngoing
                    ? '4px solid var(--status-success)'
                    : '4px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{p.goal}</h4>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      Huấn luyện viên phụ trách:{' '}
                      <strong>{p.trainer?.name ?? '—'}</strong> ({p.trainer?.email})
                    </p>
                  </div>

                  <div>
                    {isOngoing ? (
                      <span
                        className="badge badge-success"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <CheckIcon /> Đang áp dụng
                      </span>
                    ) : (
                      <span className="badge badge-neutral">Đã hoàn thành</span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-default)',
                    fontSize: '12.5px',
                  }}
                >
                  <div>
                    <span className="muted">Bắt đầu: </span>
                    <strong>{formatDate(p.startDate)}</strong>
                  </div>
                  <div>
                    <span className="muted">Kết thúc: </span>
                    <strong>{p.endDate ? formatDate(p.endDate) : 'Không giới hạn'}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CreateTrainingPlanModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void loadPlans();
        }}
        defaultHorseId={horse.id}
        defaultHorseName={horse.name}
      />
    </div>
  );
}
