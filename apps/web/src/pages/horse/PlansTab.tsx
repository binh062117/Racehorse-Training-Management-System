import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';
import { CreateTrainingPlanModal } from '../../components/training/CreateTrainingPlanModal';
import { Alert, Badge, Btn, Card, Icon } from '../../ds/ui';

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
          Chiến mã <strong>{horse.name}</strong> đã giải nghệ (RETIRED). Hệ thống không hỗ trợ lập giáo án huấn luyện mới.
        </Alert>
      )}
      {horse.healthStatus === 'QUARANTINED' && (
        <Alert tone="bad" icon="alert">
          Chiến mã đang trong diện <strong>Cách ly y tế (QUARANTINED)</strong>. Cần chờ Bác sĩ thú y gỡ cách ly trước khi lên giáo án huấn luyện.
        </Alert>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <h3 className="text-[15px] font-semibold">Giáo án &amp; Kế hoạch Huấn luyện</h3>
          <p className="cap mt-0.5">
            Mục tiêu huấn luyện và phân kỳ bài tập cho {horse.name}.
            {horse.fitnessScore != null && <span className="ml-2 font-semibold text-brand-blue">· Thể lực hiện tại: {horse.fitnessScore}/100</span>}
          </p>
        </div>
        {canCreate && isEligible && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />Tạo giáo án mới</Btn>}
      </div>

      <ErrorText err={err} />

      {loading && plans.length === 0 ? (
        <p className="cap">Đang tải kế hoạch huấn luyện…</p>
      ) : plans.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="plans" className="w-6 h-6 text-muted" />
          <p className="cap">Chiến mã này chưa có kế hoạch huấn luyện nào.</p>
          {canCreate && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />Thiết lập giáo án đầu tiên</Btn>}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((p) => {
            const isOngoing = !p.endDate || new Date(p.endDate).getTime() >= now.getTime();
            return (
              <Card key={p.id} className={`p-5 border-l-4 ${isOngoing ? 'border-l-ok' : 'border-l-line'}`}>
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h4 className="text-[15px] font-semibold">{p.goal}</h4>
                    <p className="cap mt-1">Huấn luyện viên phụ trách: <strong>{p.trainer?.name ?? '—'}</strong> ({p.trainer?.email})</p>
                  </div>
                  {isOngoing ? <Badge tone="ok"><Icon name="check" className="w-3.5 h-3.5" />Đang áp dụng</Badge> : <Badge tone="neu">Đã hoàn thành</Badge>}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-line-soft text-[12.5px]">
                  <div><span className="text-muted">Bắt đầu: </span><strong>{formatDate(p.startDate)}</strong></div>
                  <div><span className="text-muted">Kết thúc: </span><strong>{p.endDate ? formatDate(p.endDate) : 'Không giới hạn'}</strong></div>
                </div>
              </Card>
            );
          })}
        </div>
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
