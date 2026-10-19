import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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
          {i18n.t("horseFlow.horse")}{' '}<strong>{horse.name}</strong> {' '}{i18n.t("ui.isRetiredNewTrainingPlansCannotBeCreated")}</Alert>
      )}
      {horse.healthStatus === 'QUARANTINED' && (
        <Alert tone="bad" icon="alert">
          {i18n.t("ui.thisHorseIsIn")}{' '}<strong>{i18n.t("ui.medicalQuarantine")}</strong>{i18n.t("ui.waitForVeterinaryClearanceBeforeCreatingATrainingPlan")}</Alert>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <h3 className="text-[15px] font-semibold">{i18n.t("ui.trainingPlans")}</h3>
          <p className="cap mt-0.5">
            {i18n.t("ui.trainingGoalsAndPhasesFor")}{' '}{horse.name}.
            {horse.fitnessScore != null && <span className="ml-2 font-semibold text-brand-blue">{i18n.t("ui.currentFitnessScore")}{' '}{horse.fitnessScore}/100</span>}
          </p>
        </div>
        {canCreate && isEligible && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />{i18n.t("ui.createTrainingPlan")}</Btn>}
      </div>

      <ErrorText err={err} />

      {loading && plans.length === 0 ? (
        <p className="cap">{i18n.t("ui.loadingTrainingPlans2")}</p>
      ) : plans.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="plans" className="w-6 h-6 text-muted" />
          <p className="cap">{i18n.t("ui.thisHorseHasNoTrainingPlansYet")}</p>
          {canCreate && <Btn v="p" sm onClick={() => setCreateOpen(true)}><Icon name="plus" />{i18n.t("ui.createTheFirstPlan2")}</Btn>}
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
                    <p className="cap mt-1">{i18n.t("ui.assignedTrainer2")}{' '}<strong>{p.trainer?.name ?? '—'}</strong> ({p.trainer?.email})</p>
                  </div>
                  {isOngoing ? <Badge tone="ok"><Icon name="check" className="w-3.5 h-3.5" />{i18n.t("ui.active2")}</Badge> : <Badge tone="neu">{i18n.t("ui.completed")}</Badge>}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-line-soft text-[12.5px]">
                  <div><span className="text-muted">{i18n.t("ui.start")}{' '}</span><strong>{formatDate(p.startDate)}</strong></div>
                  <div><span className="text-muted">{i18n.t("ui.end")}{' '}</span><strong>{p.endDate ? formatDate(p.endDate) : i18n.t("ui.openEnded2")}</strong></div>
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
