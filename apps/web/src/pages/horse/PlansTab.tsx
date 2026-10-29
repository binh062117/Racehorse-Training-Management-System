import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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
  useTranslation();
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
          {i18n.t("incidents.horse")}<strong>{horse.name}</strong> {i18n.t("ui.isRetiredNewTrainingPlansCannotBeCreated")}</Alert>
      )}
      {horse.healthStatus === 'QUARANTINED' && (
        <Alert tone="bad" icon="alert">
          Ngựa đang trong diện <strong>{i18n.t("ui.medicalQuarantine")}</strong>{i18n.t("ui.waitForVeterinaryClearanceBeforeCreatingATrainingPlan")}</Alert>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <h3 className="text-[15px] font-semibold">{i18n.t("nav.plansTrainer")}</h3>
          <p className="text-[13px] text-muted mt-0.5">
            {plans.length === 0 ? `Mục tiêu và giai đoạn huấn luyện của ${horse.name}.` : `${plans.length} giáo án · thể lực hiện tại ${horse.fitnessScore != null ? `${horse.fitnessScore}/100` : i18n.t("ui.notAssessed2")}.`}
          </p>
        </div>
        {canCreate && isEligible && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />{i18n.t("ui.createTrainingPlan")}</Btn>}
      </div>

      <ErrorText err={err} />

      {loading && plans.length === 0 ? (
        <p className="text-muted">{i18n.t("session.loadingPlans")}</p>
      ) : plans.length === 0 ? (
        <EmptyState action={canCreate && isEligible ? <Btn v="p" sm onClick={() => setCreateOpen(true)}>{i18n.t("ui.createTheFirstPlan2")}</Btn> : undefined}>
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
                      <p className="text-[13px] text-muted mt-0.5">{i18n.t("session.trainer")}{p.trainer?.name ?? 'chưa gán'}</p>
                    </div>
                    {isOngoing ? <Badge tone="ok">{i18n.t("ui.active2")}</Badge> : <Badge tone="neu">{i18n.t("ui.ended")}</Badge>}
                  </div>
                  <p className="num text-[13px] mt-2">
                    {formatDate(p.startDate)} <span className="text-muted">{i18n.t("ui.to")}</span> {p.endDate ? formatDate(p.endDate) : <span className="text-muted">không giới hạn</span>}
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
