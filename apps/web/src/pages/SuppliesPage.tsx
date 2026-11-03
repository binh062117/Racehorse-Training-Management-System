import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useCachedResource } from '../lib/useCachedResource';
import { formatDate } from '../lib/format';
import type { Paginated, SupplyCategory, SupplyItem, SupplyRequest, SupplyRequestStatus } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Bar, Btn, Card, CardHeader, Chip, ChipCount, EmptyState, Field, Icon, Input, KpiStrip,
  Modal, ModalBody, ModalFoot, ModalHead, NativeSelect, PageHeader, Seg, Textarea, thCls, type Tone,
} from '../ds/ui';

const CATEGORIES: SupplyCategory[] = ['FEED', 'MEDICINE', 'EQUIPMENT'];
const REQUEST_TONE: Record<SupplyRequestStatus, Tone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'neu' };
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Stable supplies. Grooms see what is left and ask for more; the manager
 * keeps the list, counts stock and approves requests (an approved request is
 * added to stock). Feed used in feeding records comes out of stock by itself.
 */
export function SuppliesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isGroom = user?.role === 'GROOM';
  const canSeeRequests = isManager || isGroom;
  const [category, setCategory] = useState<'ALL' | SupplyCategory>('ALL');
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SupplyItem | 'new' | null>(null);
  const [requesting, setRequesting] = useState<SupplyItem | null>(null);
  const [reqFilter, setReqFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  usePageChrome({ crumbs: [t('supplies.title')] });

  const { data: items, error, loading, reload } = useCachedResource('supplies:items', () =>
    api.get<SupplyItem[]>('/supplies').then((r) => r.data),
  );
  const { data: requests, reload: reloadRequests } = useCachedResource(`supplies:requests:${user?.id}:${reqFilter}`, () =>
    canSeeRequests
      ? api.get<Paginated<SupplyRequest>>('/supply-requests', { params: { limit: 50, ...(reqFilter === 'PENDING' ? { status: 'PENDING' } : {}) } }).then((r) => r.data)
      : Promise.resolve(null),
  );

  const all = items ?? [];
  const lowCount = all.filter((i) => i.low).length;
  const pendingCount = all.reduce((s, i) => s + i.pendingRequests, 0);
  const q = search.trim().toLowerCase();
  const shown = all.filter((i) =>
    (category === 'ALL' || i.category === category) && (!lowOnly || i.low) && (!q || i.name.toLowerCase().includes(q)));
  const refresh = () => { void reload(); void reloadRequests(); };

  return (
    <>
      <PageHeader
        title={t('supplies.title')}
        sub={!items ? t('supplies.loading') : lowCount > 0 ? t('supplies.subLow', { low: lowCount, pending: pendingCount }) : t('supplies.subOk', { pending: pendingCount })}
        search={{ placeholder: t('supplies.search'), value: search, onChange: setSearch }}
        actions={isManager ? <Btn v="p" onClick={() => setEditing('new')}><Icon name="plus" />{t('supplies.addItem')}</Btn> : undefined}
      />

      <KpiStrip items={[
        { label: t('supplies.kpiItems'), value: all.length },
        { label: t('supplies.kpiLow'), value: lowCount, tone: lowCount > 0 ? 'bad' : undefined, lead: lowCount > 0 },
        { label: t('supplies.kpiPending'), value: pendingCount, tone: pendingCount > 0 ? 'warn' : undefined },
      ]} />

      <div className="flex flex-wrap gap-2 items-center">
        <Chip on={category === 'ALL'} onClick={() => setCategory('ALL')}>{t('supplies.all')} <ChipCount n={all.length} /></Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} on={category === c} onClick={() => setCategory(c)}>{t(`supplies.category.${c}`)} <ChipCount n={all.filter((i) => i.category === c).length} /></Chip>
        ))}
        <span className="w-px h-5 bg-line-strong mx-1" aria-hidden />
        <Chip on={lowOnly} onClick={() => setLowOnly((v) => !v)}><Icon name="alert" className="w-3.5 h-3.5" />{t('supplies.lowOnly')} <ChipCount n={lowCount} /></Chip>
      </div>

      <ErrorText err={error} />

      {loading && !items ? (
        <p className="text-muted">{t('supplies.loading')}</p>
      ) : shown.length === 0 ? (
        <EmptyState action={isManager && all.length === 0 ? <Btn sm v="p" onClick={() => setEditing('new')}>{t('supplies.addFirst')}</Btn> : undefined}>
          {all.length === 0 ? t('supplies.empty') : t('supplies.noMatch')}
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className={`${thCls} pl-5`}>{t('supplies.colName')}</th>
                  <th className={thCls}>{t('supplies.colCategory')}</th>
                  <th className={`${thCls} text-right`}>{t('supplies.colStock')}</th>
                  <th className={`${thCls} w-[160px]`}>{t('supplies.colLevel')}</th>
                  <th className={thCls}>{t('supplies.colStatus')}</th>
                  <th className={`${thCls} pr-5`} aria-label={t('horsesPage.thActions', 'Thao tác')} />
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const pct = i.minQuantity > 0 ? Math.min(100, Math.round((i.quantity / (i.minQuantity * 2)) * 100)) : 100;
                  return (
                    <tr key={i.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                      <td className="pl-5 pr-4 py-3">
                        <div className="font-medium">{i.name}</div>
                        {i.notes && <div className="text-[12.5px] text-muted">{i.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted">{t(`supplies.category.${i.category}`)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`num font-semibold hop ${i.low ? 'text-bad' : ''}`}>{fmtQty(i.quantity)}</span>
                        <span className="text-muted text-[13px]"> {i.unit}</span>
                        <div className="text-[12px] text-muted">{t('supplies.min', { n: fmtQty(i.minQuantity), unit: i.unit })}</div>
                      </td>
                      <td className="px-4 py-3"><Bar pct={pct} color={i.low ? '#c4242a' : '#1a4b8a'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {i.low ? <Badge tone="bad">{t('supplies.low')}</Badge> : <Badge tone="ok">{t('supplies.enough')}</Badge>}
                          {i.pendingRequests > 0 && <span className="text-[12px] text-warn">{t('supplies.pendingFor', { n: fmtQty(i.pendingQuantity), unit: i.unit })}</span>}
                        </div>
                      </td>
                      <td className="pl-4 pr-5 py-3 text-right whitespace-nowrap">
                        {isGroom && <Btn sm v={i.low ? 'p' : 's'} onClick={() => setRequesting(i)}><Icon name="plus" className="w-3.5 h-3.5" />{t('supplies.request')}</Btn>}
                        {isManager && <Btn sm v="g" onClick={() => setEditing(i)}><Icon name="edit" className="w-3.5 h-3.5" />{t('supplies.edit')}</Btn>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canSeeRequests && (
        <Card>
          <CardHeader title={isManager ? t('supplies.requestsTitle') : t('supplies.myRequestsTitle')}>
            <Seg value={reqFilter} onChange={(k) => setReqFilter(k as 'PENDING' | 'ALL')} options={[['PENDING', t('supplies.reqPending')], ['ALL', t('supplies.reqAll')]]} />
          </CardHeader>
          {!requests ? (
            <p className="px-5 py-4 text-muted">{t('supplies.loading')}</p>
          ) : requests.data.length === 0 ? (
            <div className="p-4"><EmptyState>{reqFilter === 'PENDING' ? t('supplies.noPendingRequests') : t('supplies.noRequests')}</EmptyState></div>
          ) : (
            <ul className="list-none m-0 p-0">
              {requests.data.map((r) => <RequestRow key={r.id} request={r} canReview={isManager} onChanged={refresh} />)}
            </ul>
          )}
        </Card>
      )}

      {editing && <ItemModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {requesting && <RequestModal item={requesting} onClose={() => setRequesting(null)} onSaved={refresh} />}
    </>
  );
}

function RequestRow({ request: r, canReview, onChanged }: { request: SupplyRequest; canReview: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const review = async (status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/supply-requests/${r.id}`, { status, ...(note.trim() ? { note: note.trim() } : {}) });
      onChanged();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-5 py-3.5 border-b border-line-soft last:border-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="font-medium">
            <span className="num">{fmtQty(r.quantity)} {r.item.unit}</span> {r.item.name}
          </div>
          <div className="text-[12.5px] text-muted mt-0.5">
            {t('supplies.requestedBy', { name: r.requestedBy.name, date: formatDate(r.createdAt) })}
            {' · '}{t('supplies.stockNow', { n: fmtQty(r.item.quantity), unit: r.item.unit })}
          </div>
          {r.note && <p className="text-[13px] mt-1">“{r.note}”</p>}
          {r.status !== 'PENDING' && r.reviewedBy && (
            <p className="text-[12.5px] text-muted mt-1">
              {t('supplies.reviewedBy', { name: r.reviewedBy.name, date: r.reviewedAt ? formatDate(r.reviewedAt) : '' })}{r.reviewNote ? ` — ${r.reviewNote}` : ''}
            </p>
          )}
        </div>
        <Badge tone={REQUEST_TONE[r.status]}>{t(`supplies.reqStatus.${r.status}`)}</Badge>
        {canReview && r.status === 'PENDING' && !rejecting && (
          <div className="flex gap-1.5">
            <Btn sm v="p" disabled={busy} onClick={() => void review('APPROVED')}><Icon name="check" className="w-3.5 h-3.5" />{t('supplies.approve')}</Btn>
            <Btn sm v="d" disabled={busy} onClick={() => setRejecting(true)}><Icon name="x" className="w-3.5 h-3.5" />{t('supplies.reject')}</Btn>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label={t('supplies.rejectReason')} className="flex-1 min-w-[220px]">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus placeholder={t('supplies.rejectPlaceholder')} />
          </Field>
          <Btn sm v="d" disabled={busy} onClick={() => void review('REJECTED')}>{t('supplies.confirmReject')}</Btn>
          <Btn sm v="g" disabled={busy} onClick={() => setRejecting(false)}>{t('common.cancel')}</Btn>
        </div>
      )}
      <ErrorText err={err} />
    </li>
  );
}

function ItemModal({ item, onClose, onSaved }: { item: SupplyItem | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<SupplyCategory>(item?.category ?? 'FEED');
  const [unit, setUnit] = useState(item?.unit ?? 'kg');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '0');
  const [minQuantity, setMinQuantity] = useState(item ? String(item.minQuantity) : '0');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = { name: name.trim(), unit: unit.trim(), quantity: Number(quantity), minQuantity: Number(minQuantity), notes: notes.trim() };
    try {
      if (item) await api.patch(`/supplies/${item.id}`, body);
      else await api.post('/supplies', { ...body, category });
      onSaved();
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item || !window.confirm(t('supplies.deleteConfirm', { name: item.name }))) return;
    setBusy(true);
    try {
      await api.delete(`/supplies/${item.id}`);
      onSaved();
      onClose();
    } catch (e2) {
      setErr(e2);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} labelledBy="supply-item-title">
      <form onSubmit={submit}>
        <ModalHead id="supply-item-title" title={item ? t('supplies.editTitle', { name: item.name }) : t('supplies.addItem')} sub={item ? t('supplies.editSub') : undefined} onClose={() => !busy && onClose()} />
        <ModalBody>
          <Field label={t('supplies.colName')} req><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={t('supplies.colCategory')}>
              <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as SupplyCategory)} disabled={!!item}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`supplies.category.${c}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('supplies.unit')} req hint={t('supplies.unitHint')}><Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} required /></Field>
            <Field label={item ? t('supplies.stockCounted') : t('supplies.stockStart')}><Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></Field>
            <Field label={t('supplies.minLabel')} hint={t('supplies.minHint')}><Input type="number" min="0" step="any" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} required /></Field>
          </div>
          <Field label={t('supplies.notes')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></Field>
          <ErrorText err={err} />
        </ModalBody>
        <ModalFoot>
          {item && <Btn v="d" onClick={() => void remove()} disabled={busy} className="mr-auto"><Icon name="trash" className="w-3.5 h-3.5" />{t('supplies.delete')}</Btn>}
          <Btn onClick={onClose} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || !name.trim() || !unit.trim()}>{busy ? t('supplies.saving') : t('common.save')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}

function RequestModal({ item, onClose, onSaved }: { item: SupplyItem; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const suggested = Math.max(item.minQuantity * 2 - item.quantity, item.minQuantity, 1);
  const [quantity, setQuantity] = useState(fmtQty(suggested));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/supply-requests', { itemId: item.id, quantity: Number(quantity), ...(note.trim() ? { note: note.trim() } : {}) });
      onSaved();
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} labelledBy="supply-request-title" width={480}>
      <form onSubmit={submit}>
        <ModalHead id="supply-request-title" title={t('supplies.requestTitle', { name: item.name })} sub={t('supplies.stockNow', { n: fmtQty(item.quantity), unit: item.unit })} onClose={() => !busy && onClose()} />
        <ModalBody>
          <Field label={t('supplies.requestQty', { unit: item.unit })} req hint={t('supplies.requestQtyHint')}>
            <Input type="number" min="0.1" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
          </Field>
          <Field label={t('supplies.requestNote')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={t('supplies.requestNotePlaceholder')} /></Field>
          <ErrorText err={err} />
        </ModalBody>
        <ModalFoot>
          <Btn onClick={onClose} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || !(Number(quantity) > 0)}><Icon name="send" className="w-3.5 h-3.5" />{busy ? t('supplies.saving') : t('supplies.sendRequest')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
