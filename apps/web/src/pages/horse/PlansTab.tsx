import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';
import { CreateTrainingPlanModal } from '../../components/training/CreateTrainingPlanModal';
import { Alert, Badge, Btn, Card, EmptyState, Icon } from '../../ds/ui';

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

  const isEligible = horse.status !== 'RETIRED' && horse.healthStatus !== 'QUARANTINED';

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Paginated<TrainingPlan>>(`/horses/${horse.id}/training-plans`);
      setPlans(res.data.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      {horse.status === 'RETIRED' && (
        <Alert tone="info" icon="info">
          Ngựa <strong>{horse.name}</strong> đã giải nghệ. Hệ thống không hỗ trợ lập giáo án huấn luyện mới.
        </Alert>
      )}
      {horse.healthStatus === 'QUARANTINED' && (
        <Alert tone="bad" icon="alert">
          Ngựa đang trong diện <strong>Cách ly y tế</strong>. Cần chờ Bác sĩ thú y gỡ cách ly trước khi lên giáo án huấn luyện.
        </Alert>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <h3 className="text-[15px] font-semibold">Giáo án huấn luyện</h3>
          <p className="text-[13px] text-muted mt-0.5">
            {plans.length === 0 ? `Mục tiêu và giai đoạn huấn luyện của ${horse.name}.` : `${plans.length} giáo án · thể lực hiện tại ${horse.fitnessScore != null ? `${horse.fitnessScore}/100` : 'chưa đánh giá'}.`}
          </p>
        </div>
        {canCreate && isEligible && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />Tạo giáo án mới</Btn>}
      </div>

      <ErrorText err={err} />

      {loading && plans.length === 0 ? (
        <p className="text-muted">Đang tải giáo án…</p>
      ) : plans.length === 0 ? (
        <EmptyState action={canCreate && isEligible ? <Btn v="p" sm onClick={() => setCreateOpen(true)}>Thiết lập giáo án đầu tiên</Btn> : undefined}>
          Ngựa này chưa có giáo án huấn luyện nào.
        </EmptyState>
      ) : (
        <Card>
          <ul className="list-none m-0 p-0">
            {plans.map((p) => {
              const isOngoing = !p.endDate || new Date(p.endDate).getTime() >= now.getTime();
              return (
                <li key={p.id} className="px-5 py-4 border-b border-line-soft last:border-0">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-semibold">{p.goal}</h4>
                      <p className="text-[13px] text-muted mt-0.5">Huấn luyện viên {p.trainer?.name ?? 'chưa gán'}</p>
                    </div>
                    {isOngoing ? <Badge tone="ok">Đang áp dụng</Badge> : <Badge tone="neu">Đã kết thúc</Badge>}
                  </div>
                  <p className="num text-[13px] mt-2">
                    {formatDate(p.startDate)} <span className="text-muted">đến</span> {p.endDate ? formatDate(p.endDate) : <span className="text-muted">không giới hạn</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <CreateTrainingPlanModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadPlans()}
        defaultHorseId={horse.id}
        defaultHorseName={horse.name}
      />
    </div>
  );
}
