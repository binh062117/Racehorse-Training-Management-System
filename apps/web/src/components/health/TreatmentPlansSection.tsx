import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { Alert, Badge, Btn, Card, Icon } from '../../ds/ui';
import type { Medication, TreatmentPlan } from '../../lib/types';
import { listMedications, listTreatmentPlans } from '../../lib/treatmentPlans';
import { ErrorText } from '../ErrorText';
import { AddMedicationModal } from './AddMedicationModal';
import { CreateTreatmentPlanModal } from './CreateTreatmentPlanModal';

// Only mounted after the examination's treatment section is expanded.
function useTreatmentList<T>(id: string, fetchList: (id: string) => Promise<T[]>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ id: string; version: number; items: T[]; err: unknown } | null>(null);
  useEffect(() => {
    let active = true;
    fetchList(id).then((items) => { if (active) setResult({ id, version, items, err: null }); })
      .catch((err: unknown) => { if (active) setResult({ id, version, items: [], err }); });
    return () => { active = false; };
  }, [id, fetchList, version]);
  const current = result?.id === id && result.version === version ? result : null;
  return { items: current?.items ?? [], loading: !current, err: current?.err, reload: () => setVersion((v) => v + 1) };
}

export function TreatmentPlansSection({ recordId }: { recordId: string }) {
  const { t } = useTranslation();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="mt-4 border-t border-line pt-4">
      <Btn sm aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
        <Icon name={expanded ? 'chevDown' : 'chevRight'} />{t('treatmentPlans.title')}
      </Btn>
      <div id={id} hidden={!expanded}>
        {expanded && <PlanList key={recordId} recordId={recordId} />}
      </div>
    </section>
  );
}

function PlanList({ recordId }: { recordId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isVet = user?.role === 'VET';
  const { items, loading, err, reload } = useTreatmentList(recordId, listTreatmentPlans);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-3 mt-3" aria-busy={loading}>
      <p className="cap">{t('treatmentPlans.scope')}</p>
      {saved && <Alert tone="ok">{t('treatmentPlans.planSaved')}</Alert>}
      {loading ? <p role="status" className="cap">{t('treatmentPlans.loading')}</p> : err ? (
        <div><ErrorText err={err} /><Btn sm onClick={reload}>{t('treatmentPlans.retry')}</Btn></div>
      ) : items.length === 0 ? <p className="cap">{t('treatmentPlans.empty')}</p> : (
        items.map((plan) => <PlanCard key={plan.id} plan={plan} isVet={isVet} />)
      )}
      {isVet && <Btn className="self-start" onClick={() => { setSaved(false); setCreating(true); }}><Icon name="plus" />{t('treatmentPlans.addPlan')}</Btn>}
      {creating && <CreateTreatmentPlanModal recordId={recordId} onClose={() => setCreating(false)} onCreated={() => {
        setCreating(false); setSaved(true); reload();
      }} />}
    </div>
  );
}

function PlanCard({ plan, isVet }: { plan: TreatmentPlan; isVet: boolean }) {
  const { t, i18n } = useTranslation();
  const { items, loading, err, reload } = useTreatmentList<Medication>(plan.id, listMedications);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium' }).format(new Date(value))
    : t('treatmentPlans.notRecorded');
  return (
    <Card className="p-4 min-w-0">
      <Badge tone={plan.status === 'ACTIVE' ? 'info' : plan.status === 'COMPLETED' ? 'ok' : 'neu'}>{t(`treatmentPlans.status.${plan.status}`)}</Badge>
      <p className="mt-2 whitespace-pre-wrap break-words font-medium">{plan.description}</p>
      <dl className="grid gap-2 sm:grid-cols-2 mt-3 text-[12.5px]">
        <div><dt className="text-muted">{t('treatmentPlans.startDate')}</dt><dd>{date(plan.startDate)}</dd></div>
        <div><dt className="text-muted">{t('treatmentPlans.endDate')}</dt><dd>{date(plan.endDate)}</dd></div>
      </dl>
      <h4 className="font-semibold mt-4 mb-2">{t('treatmentPlans.medications')}</h4>
      {saved && <Alert tone="ok" className="mb-2">{t('treatmentPlans.medicationSaved')}</Alert>}
      {loading ? <p role="status" className="cap">{t('treatmentPlans.loading')}</p> : err ? (
        <div><ErrorText err={err} /><Btn sm onClick={reload}>{t('treatmentPlans.retry')}</Btn></div>
      ) : items.length === 0 ? <p className="cap">{t('treatmentPlans.noMedications')}</p> : (
        <ul className="list-none p-0 divide-y divide-line-soft">
          {items.map((med) => (
            <li key={med.id} className="py-3 grid gap-2 sm:grid-cols-2 break-words">
              <div><span className="cap block">{t('treatmentPlans.medicationName')}</span><strong>{med.name}</strong></div>
              <div><span className="cap block">{t('treatmentPlans.dosage')}</span>{med.dosage?.trim() || t('treatmentPlans.notRecorded')}</div>
              {(med.startDate || med.endDate) && <div className="sm:col-span-2 text-[12.5px] text-muted">
                {t('treatmentPlans.startDate')}: {date(med.startDate)} · {t('treatmentPlans.endDate')}: {date(med.endDate)}
              </div>}
            </li>
          ))}
        </ul>
      )}
      {isVet && <Btn sm className="mt-3" onClick={() => { setSaved(false); setAdding(true); }}><Icon name="plus" />{t('treatmentPlans.addMedication')}</Btn>}
      {adding && <AddMedicationModal planId={plan.id} onClose={() => setAdding(false)} onCreated={() => {
        setAdding(false); setSaved(true); reload();
      }} />}
    </Card>
  );
}
