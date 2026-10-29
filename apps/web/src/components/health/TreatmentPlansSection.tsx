import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createMedication, createTreatmentPlan, listMedications, listTreatmentPlans } from '../../lib/treatmentPlans';
import type { Medication, TreatmentPlan } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { formatDate } from '../../lib/format';
import { Btn, Field, Icon, Input, Textarea } from '../../ds/ui';

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

interface Props {
  healthRecordId: string;
  isVet: boolean;
}

/** Collapsible "treatment plans + medications" block for a health record (UC-20). */
export function TreatmentPlansSection({ healthRecordId, isVet }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);


  return (
    <div className="mt-3.5 pt-3.5 border-t border-line-soft">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-info">
        <Icon name={open ? 'chevDown' : 'chevRight'} className="w-3.5 h-3.5" />
        {t("treatmentPlans.title")}
      </button>

      <div id={id} hidden={!open}>
        {open && <PlanList key={healthRecordId} healthRecordId={healthRecordId} isVet={isVet} />}
      </div>
    </div>
  );
}

function PlanList({ healthRecordId, isVet }: Props) {
  const { t } = useTranslation();
  const { items: plans, loading, err, reload } = useTreatmentList(healthRecordId, listTreatmentPlans);
  const [formOpen, setFormOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="mt-3 flex flex-col gap-3" aria-busy={loading}>
      <p className="cap">{t('treatmentPlans.scope')}</p>
      {saved && <p role="status" className="text-ok">{t('treatmentPlans.planSaved')}</p>}
      {loading ? <p className="cap" role="status">{t('treatmentPlans.loading')}</p> : err ? (
        <div><ErrorText err={err} /><Btn sm onClick={reload}>{t('treatmentPlans.retry')}</Btn></div>
      ) : plans.length === 0 ? <p className="cap">{t('treatmentPlans.empty')}</p> : (
        plans.map((plan) => <PlanItem key={plan.id} plan={plan} isVet={isVet} />)
      )}
      {isVet && (formOpen ? (
        <CreatePlanForm healthRecordId={healthRecordId} onCancel={() => setFormOpen(false)}
          onCreated={() => { setFormOpen(false); setSaved(true); reload(); }} />
      ) : <Btn sm onClick={() => { setSaved(false); setFormOpen(true); }}><Icon name="plus" />{t('treatmentPlans.addPlan')}</Btn>)}
    </div>
  );
}

function PlanItem({ plan, isVet }: { plan: TreatmentPlan; isVet: boolean }) {
  const { t } = useTranslation();
  const { items: medications, loading, err, reload: load } = useTreatmentList<Medication>(plan.id, listMedications);
  const [formOpen, setFormOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-btn border border-line p-3.5">
      <p className="cap">{t(`treatmentPlans.status.${plan.status}`)}</p>
      <p className="leading-relaxed whitespace-pre-wrap break-words">{plan.description}</p>
      <p className="cap mt-1">{formatDate(plan.startDate)} — {plan.endDate ? formatDate(plan.endDate) : t('treatmentPlans.notRecorded')}</p>

      {saved && <p role="status" className="text-ok">{t("treatmentPlans.medicationSaved")}</p>}
      <div className="mt-2.5 pl-3 border-l-2 border-line-soft flex flex-col gap-2">
        <span className="lbl">{t('treatmentPlans.medications')}</span>
        {loading ? (
          <p className="cap">{t("treatmentPlans.loading")}</p>
        ) : (
          <>
            <ErrorText err={err} />
            {!!err && <Btn sm onClick={load}>{t('treatmentPlans.retry')}</Btn>}
            {!err && medications.length === 0 && !formOpen && <p className="cap">{t('treatmentPlans.noMedications')}</p>}
            {medications?.map((m) => (
              <div key={m.id} className="text-[13px]">
                <strong>{m.name}</strong>
                {m.dosage && <span className="cap"> · {m.dosage}</span>}
                {(m.startDate || m.endDate) && (
                  <span className="cap"> · {m.startDate ? formatDate(m.startDate) : '—'} — {m.endDate ? formatDate(m.endDate) : t('treatmentPlans.notRecorded')}</span>
                )}
              </div>
            ))}
          </>
        )}

        {isVet && (
          formOpen ? (
            <CreateMedicationForm
              planId={plan.id}
              onCancel={() => setFormOpen(false)}
              onCreated={() => { setFormOpen(false); setSaved(true); load(); }}
            />
          ) : (
            <Btn sm onClick={() => setFormOpen(true)}><Icon name="plus" className="w-3.5 h-3.5" />{t("treatmentPlans.addMedication")}</Btn>
          )
        )}
      </div>
    </div>
  );
}

function CreatePlanForm({ healthRecordId, onCancel, onCreated }: {
  healthRecordId: string; onCancel: () => void; onCreated: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const saving = useRef(false);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const close = () => { if (!saving.current) onCancel(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    setErr(null);
    setValidation('');
    if (!description.trim()) { setValidation('descriptionRequired'); return; }
    if (!startDate || !Number.isFinite(Date.parse(startDate)) || (endDate && !Number.isFinite(Date.parse(endDate)))) {
      setValidation('invalidDates'); return;
    }
    if (endDate && endDate < startDate) { setValidation('dateOrder'); return; }
    saving.current = true;
    setBusy(true);
    try {
      await createTreatmentPlan(healthRecordId, {
        description: description.trim(), startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        ...(endDate ? { endDate: new Date(`${endDate}T00:00:00`).toISOString() } : {}),
      });
      onCreated();
    } catch (error) {
      setErr(error);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-btn border border-line bg-subtle p-3.5 flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          {validation && <p role="alert" className="text-bad">{t(`treatmentPlans.${validation}`)}</p>}
          <ErrorText err={err} />
          <Field label={t('treatmentPlans.description')} htmlFor={`${id}-description`} req>
            <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} required disabled={busy} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('treatmentPlans.startDate')} htmlFor={`${id}-start`} req>
              <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={busy} />
            </Field>
            <Field label={t('treatmentPlans.endDate')} htmlFor={`${id}-end`} hint={t('treatmentPlans.optional')}>
              <Input id={`${id}-end`} type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn onClick={close} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{t(busy ? 'treatmentPlans.saving' : 'common.save')}</Btn>
        </div>
      </form>

  );
}

function CreateMedicationForm({ planId, onCancel, onCreated }: {
  planId: string; onCancel: () => void; onCreated: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const saving = useRef(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const close = () => { if (!saving.current) onCancel(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    setErr(null);
    setValidation('');
    if (!name.trim()) { setValidation('nameRequired'); return; }
    if ((startDate && !Number.isFinite(Date.parse(startDate))) || (endDate && !Number.isFinite(Date.parse(endDate)))) {
      setValidation('invalidDates'); return;
    }
    if (startDate && endDate && endDate < startDate) { setValidation('dateOrder'); return; }
    saving.current = true;
    setBusy(true);
    try {
      await createMedication(planId, {
        name: name.trim(), ...(dosage.trim() ? { dosage: dosage.trim() } : {}),
        ...(startDate ? { startDate: new Date(`${startDate}T00:00:00`).toISOString() } : {}), ...(endDate ? { endDate: new Date(`${endDate}T00:00:00`).toISOString() } : {}),
      });
      onCreated();
    } catch (error) {
      setErr(error);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-btn border border-line bg-subtle p-3.5 flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          {validation && <p role="alert" className="text-bad">{t(`treatmentPlans.${validation}`)}</p>}
          <ErrorText err={err} />
          <Field label={t('treatmentPlans.medicationName')} htmlFor={`${id}-name`} req>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required disabled={busy} />
          </Field>
          <Field label={t('treatmentPlans.dosage')} htmlFor={`${id}-dosage`} hint={t('treatmentPlans.optional')}>
            <Input id={`${id}-dosage`} value={dosage} onChange={(e) => setDosage(e.target.value)} maxLength={120} disabled={busy} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('treatmentPlans.startDate')} htmlFor={`${id}-start`} hint={t('treatmentPlans.optional')}>
              <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy} />
            </Field>
            <Field label={t('treatmentPlans.endDate')} htmlFor={`${id}-end`} hint={t('treatmentPlans.optional')}>
              <Input id={`${id}-end`} type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn onClick={close} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy}>{t(busy ? 'treatmentPlans.saving' : 'common.save')}</Btn>
        </div>
      </form>

  );
}
