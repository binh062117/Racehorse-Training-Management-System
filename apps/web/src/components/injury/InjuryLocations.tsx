import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { InjuryLocation } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { BODY_ZONES, HorseMap } from '../../ds/charts';
import { Btn, Field, Icon, Input, Modal, ModalBody, ModalFoot, ModalHead, Seg, Textarea } from '../../ds/ui';

/**
 * UC-16 — Record injury location. An injury location belongs to whichever
 * record it originates from: an incident report or a health record
 * (POST/GET /incidents/:id/injury-locations, /health-records/:id/injury-locations).
 * Only VET may record; every role that can see the parent record may view.
 *
 * bodyRegion/side are free text on the API. New records use the body-map
 * zone names (BODY_ZONES) and LEFT/RIGHT so they can be re-plotted on the map.
 */

export type InjurySource = 'incidents' | 'health-records';
type Side = 'LEFT' | 'RIGHT';

const SIDE_LABEL: Record<string, string> = { LEFT: 'Bên trái', RIGHT: 'Bên phải', L: 'Bên trái', R: 'Bên phải' };
const sideLabel = (side: string | null) => (side ? SIDE_LABEL[side.toUpperCase()] ?? side : null);
const mapSide = (side: string | null): 'L' | 'R' => (side && ['RIGHT', 'R'].includes(side.toUpperCase()) ? 'R' : 'L');
const zoneOf = (bodyRegion: string) => BODY_ZONES.find((z) => z.name === bodyRegion || z.key === bodyRegion)?.key ?? null;

export function InjuryLocationsPanel({ source, parentId, canRecord, onCountChange }: {
  source: InjurySource;
  parentId: string;
  canRecord: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<InjuryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<InjuryLocation[]>(`/${source}/${parentId}/injury-locations`);
      setItems(res.data);
      setErr(null);
      onCountChange?.(res.data.length);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
    // onCountChange is a notification callback — don't refetch when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, parentId]);

  useEffect(() => { void load(); }, [load]);

  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-soft bg-subtle p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon name="pin" className="w-4 h-4 text-bad" />
          <span className="lbl">Vị trí chấn thương</span>
        </div>
        {canRecord && <Btn sm v="p" onClick={() => setModalOpen(true)}><Icon name="plus" />Ghi vị trí chấn thương</Btn>}
      </div>

      <ErrorText err={err} />
      {loading ? (
        <p className="cap">Đang tải vị trí chấn thương…</p>
      ) : items.length === 0 ? (
        <p className="cap">Chưa ghi nhận vị trí chấn thương nào{canRecord ? ' — bấm "Ghi vị trí chấn thương" để đánh dấu trên sơ đồ.' : '.'}</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
          <div>
            <HorseMap readOnly zone={active ? zoneOf(active.bodyRegion) : null} side={mapSide(active?.side ?? null)} />
            {active && !zoneOf(active.bodyRegion) && <p className="cap mt-1">"{active.bodyRegion}" không nằm trên sơ đồ chuẩn.</p>}
          </div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {items.map((loc) => {
              const on = loc.id === active?.id;
              return (
                <li key={loc.id}>
                  <button type="button" onClick={() => setActiveId(loc.id)} aria-pressed={on}
                    className={`w-full text-left rounded-btn border px-3 py-2 bg-white ${on ? 'border-bad ring-1 ring-bad' : 'border-line hover:border-muted'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-[13px]">{loc.bodyRegion}</strong>
                      {sideLabel(loc.side) && <span className="cap">· {sideLabel(loc.side)}</span>}
                      <span className="cap ml-auto">{formatDateTime(loc.createdAt)}</span>
                    </div>
                    {loc.notes && <p className="text-[12.5px] mt-1 leading-relaxed">{loc.notes}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canRecord && (
        <RecordInjuryLocationModal
          open={modalOpen}
          source={source}
          parentId={parentId}
          onClose={() => setModalOpen(false)}
          onCreated={(loc) => { setActiveId(loc.id); void load(); }}
        />
      )}
    </div>
  );
}

function RecordInjuryLocationModal({ open, source, parentId, onClose, onCreated }: {
  open: boolean;
  source: InjurySource;
  parentId: string;
  onClose: () => void;
  onCreated: (loc: InjuryLocation) => void;
}) {
  const [zone, setZone] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [side, setSide] = useState<Side>('LEFT');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const zoneName = BODY_ZONES.find((z) => z.key === zone)?.name;
  const bodyRegion = custom.trim() || zoneName || '';

  const reset = () => { setZone(null); setCustom(''); setSide('LEFT'); setNotes(''); setErr(null); };
  const close = () => { if (!busy) { reset(); onClose(); } };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bodyRegion) {
      setErr(new Error('Vui lòng chọn một vị trí trên sơ đồ hoặc nhập vị trí khác.'));
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const body: Record<string, string> = { bodyRegion, side };
      if (notes.trim()) body.notes = notes.trim();
      const res = await api.post<InjuryLocation>(`/${source}/${parentId}/injury-locations`, body);
      reset();
      onCreated(res.data);
      onClose();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} width={620} labelledBy="record-injury-location-title">
      <ModalHead icon="pin" tone="bad" id="record-injury-location-title" onClose={close}
        title="Ghi nhận vị trí chấn thương"
        sub={source === 'incidents' ? 'Gắn vào báo cáo sự cố này.' : 'Gắn vào hồ sơ khám này.'} />
      <form onSubmit={submit}>
        <ModalBody>
          <ErrorText err={err} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="cap">Bấm vào một điểm trên sơ đồ để chọn vùng cơ thể.</span>
            <Seg options={[['LEFT', 'Bên trái'], ['RIGHT', 'Bên phải']]} value={side} onChange={(k) => setSide(k as Side)} />
          </div>
          <HorseMap zone={custom.trim() ? null : zone} side={side === 'RIGHT' ? 'R' : 'L'}
            onZone={(k) => { setZone(k); setCustom(''); }} label={custom.trim() ? undefined : zoneName} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vùng cơ thể">
            {BODY_ZONES.map((z) => (
              <button key={z.key} type="button" onClick={() => { setZone(z.key); setCustom(''); }} aria-pressed={zone === z.key && !custom.trim()}
                className={`h-[26px] px-2.5 rounded-full border text-[12px] ${zone === z.key && !custom.trim() ? 'bg-bad text-white border-bad' : 'bg-white text-ink border-line'}`}>
                {z.name}
              </button>
            ))}
          </div>
          <Field label="Vị trí khác (nếu không có trên sơ đồ)" hint="Nhập sẽ thay cho vùng đã chọn trên sơ đồ.">
            <Input value={custom} maxLength={120} onChange={(e) => setCustom(e.target.value)} placeholder="VD: Khớp gối trước" />
          </Field>
          <Field label="Ghi chú" hint="Mức độ sưng, vết thương, kích thước…">
            <Textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} placeholder="VD: Sưng nóng, đau khi ấn, vết xước dài ~3cm" />
          </Field>
          {bodyRegion && (
            <p className="text-[13px]">Sẽ lưu: <strong>{bodyRegion}</strong> · {SIDE_LABEL[side]}</p>
          )}
        </ModalBody>
        <ModalFoot>
          <Btn onClick={close} disabled={busy}>Hủy</Btn>
          <Btn v="p" type="submit" disabled={busy || !bodyRegion}>{busy ? 'Đang lưu…' : 'Lưu vị trí'}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
