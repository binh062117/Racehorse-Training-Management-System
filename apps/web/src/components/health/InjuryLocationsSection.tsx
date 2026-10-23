import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { formatDate } from '../../lib/format';
import { Btn, Field, Icon, Textarea } from '../../ds/ui';
import { BODY_ZONES, HorseMap } from '../../ds/charts';

interface InjuryLocation {
  id: string;
  bodyRegion: string;
  side: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  /** API path prefix this injury-location list/create lives under, e.g. `/health-records/<id>` or `/incidents/<id>`. */
  basePath: string;
  isVet: boolean;
}

/** Collapsible "injury locations" block for a health record or incident (UC-16). */
export function InjuryLocationsSection({ basePath, isVet }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<InjuryLocation[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<InjuryLocation[]>(`${basePath}/injury-locations`);
      setItems(res.data);
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
        Vị trí chấn thương {items.length > 0 ? `(${items.length})` : ''}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && <p className="cap" role="status">Đang tải…</p>}
          <ErrorText err={err} />

          {!loading && loaded && items.length === 0 && !formOpen && (
            <p className="cap">Chưa ghi nhận vị trí chấn thương nào.</p>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const zone = BODY_ZONES.find((z) => z.name === item.bodyRegion);
                return (
                  <div key={item.id} className="rounded-btn border border-line p-3">
                    {zone && (
                      <div className="max-w-[220px]">
                        <HorseMap zone={zone.key} side={item.side === 'R' ? 'R' : 'L'} readOnly label={item.bodyRegion} />
                      </div>
                    )}
                    <p className="font-semibold text-[13px] mt-2">{item.bodyRegion}{item.side ? ` · ${item.side === 'R' ? 'Phải' : 'Trái'}` : ''}</p>
                    {item.notes && <p className="cap mt-1">{item.notes}</p>}
                    <p className="cap mt-1">{formatDate(item.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {isVet && (
            formOpen ? (
              <CreateInjuryLocationForm
                basePath={basePath}
                onCancel={() => setFormOpen(false)}
                onCreated={() => { setFormOpen(false); void load(); }}
              />
            ) : (
              <Btn sm onClick={() => setFormOpen(true)}><Icon name="plus" className="w-3.5 h-3.5" />Thêm vị trí chấn thương</Btn>
            )
          )}
        </div>
      )}
    </div>
  );
}

function CreateInjuryLocationForm({ basePath, onCancel, onCreated }: { basePath: string; onCancel: () => void; onCreated: () => void }) {
  const [zoneKey, setZoneKey] = useState<string | null>(null);
  const [side, setSide] = useState<'L' | 'R'>('L');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const zone = BODY_ZONES.find((z) => z.key === zoneKey);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!zone) {
      setErr(new Error('Vui lòng chọn vị trí trên sơ đồ.'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`${basePath}/injury-locations`, {
        bodyRegion: zone.name,
        side,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
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
      <div className="flex gap-3 items-start flex-wrap">
        <div className="w-full max-w-[280px]">
          <HorseMap zone={zoneKey} side={side} onZone={setZoneKey} label={zone?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="lbl">Bên</span>
          <div className="flex gap-1.5">
            <Btn sm v={side === 'L' ? 'p' : 's'} type="button" onClick={() => setSide('L')}>Trái</Btn>
            <Btn sm v={side === 'R' ? 'p' : 's'} type="button" onClick={() => setSide('R')}>Phải</Btn>
          </div>
          {zone && <p className="cap mt-1">Đã chọn: {zone.name}</p>}
        </div>
      </div>
      <Field label="Ghi chú (tùy chọn)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
      </Field>
      <ErrorText err={err} />
      <div className="flex gap-2">
        <Btn v="p" sm type="submit" disabled={busy || !zone}>Lưu vị trí</Btn>
        <Btn sm onClick={onCancel} disabled={busy}>Hủy</Btn>
      </div>
    </form>
  );
}
