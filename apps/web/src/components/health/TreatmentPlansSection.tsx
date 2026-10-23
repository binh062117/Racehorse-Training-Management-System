import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Medication, TreatmentPlan } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { formatDate } from '../../lib/format';
import { Btn, Field, Icon, Input, Textarea } from '../../ds/ui';

interface Props {
  healthRecordId: string;
  isVet: boolean;
}

/** Collapsible "treatment plans + medications" block for a health record (UC-20). */
export function TreatmentPlansSection({ healthRecordId, isVet }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<TreatmentPlan[]>(`/health-records/${healthRecordId}/treatment-plans`);
      setPlans(res.data);
      setLoaded(true);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) void load();
  };

  return (
    <div className="mt-3.5 pt-3.5 border-t border-line-soft">
      <button type="button" onClick={toggle} className="flex items-center gap-1.5 text-[13px] font-semibold text-info">
        <Icon name={open ? 'chevDown' : 'chevRight'} className="w-3.5 h-3.5" />
        Phác đồ điều trị {plans.length > 0 ? `(${plans.length})` : ''}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && <p className="cap" role="status">Đang tải phác đồ…</p>}
          <ErrorText err={err} />

          {!loading && loaded && plans.length === 0 && !formOpen && (
            <p className="cap">Chưa có phác đồ điều trị nào cho lần khám này.</p>
          )}

          {plans.map((plan) => <PlanItem key={plan.id} plan={plan} isVet={isVet} />)}

          {isVet && (
            formOpen ? (
              <CreatePlanForm
                healthRecordId={healthRecordId}
                onCancel={() => setFormOpen(false)}
                onCreated={() => { setFormOpen(false); void load(); }}
              />
            ) : (
              <Btn sm onClick={() => setFormOpen(true)}><Icon name="plus" className="w-3.5 h-3.5" />Thêm phác đồ điều trị</Btn>
            )
          )}
        </div>
      )}
    </div>
  );
}

function PlanItem({ plan, isVet }: { plan: TreatmentPlan; isVet: boolean }) {
  const [medications, setMedications] = useState<Medication[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<Medication[]>(`/treatment-plans/${plan.id}/medications`);
      setMedications(res.data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="rounded-btn border border-line p-3.5">
      <p className="leading-relaxed">{plan.description}</p>
      <p className="cap mt-1">{formatDate(plan.startDate)} — {plan.endDate ? formatDate(plan.endDate) : 'đang điều trị'}</p>

      <div className="mt-2.5 pl-3 border-l-2 border-line-soft flex flex-col gap-2">
        <span className="lbl">Thuốc &amp; liều lượng</span>
        {loading ? (
          <p className="cap">Đang tải…</p>
        ) : (
          <>
            <ErrorText err={err} />
            {medications && medications.length === 0 && !formOpen && <p className="cap">Chưa có thuốc nào được kê.</p>}
            {medications?.map((m) => (
              <div key={m.id} className="text-[13px]">
                <strong>{m.name}</strong>
                {m.dosage && <span className="cap"> · {m.dosage}</span>}
                {(m.startDate || m.endDate) && (
                  <span className="cap"> · {m.startDate ? formatDate(m.startDate) : '—'} — {m.endDate ? formatDate(m.endDate) : 'đang dùng'}</span>
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
              onCreated={() => { setFormOpen(false); void load(); }}
            />
          ) : (
            <Btn sm onClick={() => setFormOpen(true)}><Icon name="plus" className="w-3.5 h-3.5" />Thêm thuốc</Btn>
          )
        )}
      </div>
    </div>
  );
}

function CreatePlanForm({ healthRecordId, onCancel, onCreated }: { healthRecordId: string; onCancel: () => void; onCreated: () => void }) {
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/health-records/${healthRecordId}/treatment-plans`, {
        description: description.trim(),
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        ...(endDate ? { endDate: new Date(`${endDate}T00:00:00`).toISOString() } : {}),
      });
      onCreated();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-btn border border-line bg-subtle p-3.5 flex flex-col gap-3">
      <Field label="Mô tả phác đồ">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày bắt đầu"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
        <Field label="Ngày kết thúc (tùy chọn)"><Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <ErrorText err={err} />
      <div className="flex gap-2">
        <Btn v="p" sm type="submit" disabled={busy}>Lưu phác đồ</Btn>
        <Btn sm onClick={onCancel} disabled={busy}>Hủy</Btn>
      </div>
    </form>
  );
}

function CreateMedicationForm({ planId, onCancel, onCreated }: { planId: string; onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/treatment-plans/${planId}/medications`, {
        name: name.trim(),
        ...(dosage.trim() ? { dosage: dosage.trim() } : {}),
        ...(startDate ? { startDate: new Date(`${startDate}T00:00:00`).toISOString() } : {}),
        ...(endDate ? { endDate: new Date(`${endDate}T00:00:00`).toISOString() } : {}),
      });
      onCreated();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Tên thuốc"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></Field>
        <Field label="Liều lượng (tùy chọn)"><Input value={dosage} onChange={(e) => setDosage(e.target.value)} maxLength={120} placeholder="vd: 10mg x2/ngày" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Ngày bắt đầu"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="Ngày kết thúc (tùy chọn)"><Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <ErrorText err={err} />
      <div className="flex gap-2">
        <Btn v="p" sm type="submit" disabled={busy}>Lưu thuốc</Btn>
        <Btn sm onClick={onCancel} disabled={busy}>Hủy</Btn>
      </div>
    </form>
  );
}
