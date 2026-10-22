import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, Paginated, TrainingPlan } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Alert, Btn, Chip, Field, Input, Modal, ModalBody, ModalFoot, ModalHead, Textarea } from '../../ds/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plan: TrainingPlan) => void;
  defaultHorseId?: string;
  defaultHorseName?: string;
}

const GOAL_TEMPLATE_KEYS = [0, 1, 2, 3] as const;

export function CreateTrainingPlanModal({ isOpen, onClose, onCreated, defaultHorseId, defaultHorseName }: Props) {
  const { t } = useTranslation();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState(defaultHorseId ?? '');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');

  const [loadingHorses, setLoadingHorses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErr(null);
    setGoal('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');

    if (defaultHorseId) {
      setHorseId(defaultHorseId);
    } else {
      setHorseId('');
      setLoadingHorses(true);
      api
        .get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
        .then((res) => {
          const all = res.data.data ?? [];
          // BR: exclude RETIRED and QUARANTINED — backend will reject anyway
          const eligible = all.filter((h) => h.status !== 'RETIRED' && h.healthStatus !== 'QUARANTINED');
          setHorses(eligible);
          if (eligible.length > 0) setHorseId(eligible[0].id);
        })
        .catch((e) => setErr(e))
        .finally(() => setLoadingHorses(false));
    }
  }, [isOpen, defaultHorseId]);

  const selectedHorse = defaultHorseId ? null : horses.find((h) => h.id === horseId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const targetHorseId = defaultHorseId ?? horseId;
    if (!targetHorseId) {
      setErr(new Error(t('trainingPlanModal.horseRequired')));
      return;
    }
    if (!goal.trim()) {
      setErr(new Error(t('trainingPlanModal.goalRequired')));
      return;
    }
    if (!startDate) {
      setErr(new Error(t('trainingPlanModal.dateRequired')));
      return;
    }
    if (endDate && endDate < startDate) {
      setErr(new Error(t('trainingPlanModal.endBeforeStart')));
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<TrainingPlan>(`/horses/${targetHorseId}/training-plans`, {
        goal: goal.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      onCreated(res.data);
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const selectCls = 'h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info';

  return (
    <Modal open={isOpen} onClose={() => !busy && onClose()} width={560} labelledBy="create-plan-title">
      <ModalHead icon="plans" title={t('trainingPlanModal.title')} id="create-plan-title" onClose={() => !busy && onClose()} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <ErrorText err={err} />

          {defaultHorseId ? (
            <Field label={t('trainingPlanModal.horse')}>
              <Input value={defaultHorseName ?? defaultHorseId} disabled ro />
            </Field>
          ) : (
            <Field label={t('trainingPlanModal.chooseHorse')} hint={t('trainingPlanModal.eligibilityHint')}>
              {loadingHorses ? (
                <p className="cap">{t('trainingPlanModal.loadingHorses')}</p>
              ) : (
                <select className={selectCls} value={horseId} onChange={(e) => setHorseId(e.target.value)} required>
                  {horses.length === 0 && <option value="">{t('trainingPlanModal.noEligibleHorse')}</option>}
                  {horses.map((h) => {
                    const tags: string[] = [];
                    if (h.status === 'RESTING') tags.push(t('horseStatusBadge.RESTING'));
                    if (h.healthStatus === 'INJURED') tags.push(t('horseStatusBadge.INJURED'));
                    if (h.healthStatus === 'MONITORING') tags.push(t('horseStatusBadge.MONITORING'));
                    if (h.locked) tags.push(t('horseStatusBadge.locked'));
                    const suffix = tags.length > 0 ? ` [${tags.join(' · ')}]` : '';
                    return (
                      <option key={h.id} value={h.id}>
                        {h.name} {h.breed ? `(${h.breed})` : ''} — {t('trainingPlanModal.owner')} {h.owner.name}{suffix}
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>
          )}

          {(selectedHorse?.locked || selectedHorse?.healthStatus === 'INJURED') && (
            <Alert tone="warn" icon="alert" title={t('trainingPlanModal.warning')}>
              {selectedHorse.locked && (
                t('trainingPlanModal.lockedWarning', {
                  reason: selectedHorse.lockReason ? ` (${selectedHorse.lockReason})` : '',
                })
              )}
              {!selectedHorse.locked && selectedHorse.healthStatus === 'INJURED' && (
                t('trainingPlanModal.injuredWarning')
              )}
            </Alert>
          )}

          <Field label={t('trainingPlanModal.goal')} hint={t('trainingPlanModal.goalHint')}>
            <Textarea
              rows={3} value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder={t('trainingPlanModal.goalPlaceholder')}
              required maxLength={500}
            />
            <div className="mt-2">
              <div className="cap mb-1.5">{t('trainingPlanModal.templatesHint')}</div>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_TEMPLATE_KEYS.map((index) => {
                  const template = t(`trainingPlanModal.goals.${index}`);
                  return (
                    <Chip key={index} onClick={() => setGoal(template)} className="h-auto py-1 text-[11.5px]">+ {template}</Chip>
                  );
                })}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label={t('trainingPlanModal.startDate')}>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label={t('trainingPlanModal.endDate')}>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </ModalBody>

        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || loadingHorses}>{busy ? t('trainingPlanModal.creating') : t('trainingPlanModal.create')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
