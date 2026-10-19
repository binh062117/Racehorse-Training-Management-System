import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
 * bodyRegion/side are free text on the API. New records store the canonical
 * (Vietnamese) BODY_ZONES name and LEFT/RIGHT so they can be re-plotted on
 * the map; only the on-screen label is translated (injury.zones.<key>).
 */

export type InjurySource = 'incidents' | 'health-records';
type Side = 'LEFT' | 'RIGHT';

const isRight = (side: string | null) => !!side && ['RIGHT', 'R'].includes(side.toUpperCase());
const isLeft = (side: string | null) => !!side && ['LEFT', 'L'].includes(side.toUpperCase());
const zoneOf = (bodyRegion: string) => BODY_ZONES.find((z) => z.name === bodyRegion || z.key === bodyRegion)?.key ?? null;

/** BODY_ZONES with names in the current UI language (for map tooltips/labels). */
function useZones() {
  const { t } = useTranslation();
  return useMemo(() => BODY_ZONES.map((z) => ({ ...z, name: t(`injury.zones.${z.key}`) })), [t]);
}

function useLabels() {
  const { t } = useTranslation();
  return {
    region: (bodyRegion: string) => {
      const key = zoneOf(bodyRegion);
      return key ? t(`injury.zones.${key}`) : bodyRegion;
    },
    side: (side: string | null) => (isRight(side) ? t('injury.right') : isLeft(side) ? t('injury.left') : side),
  };
}

export function InjuryLocationsPanel({ source, parentId, canRecord, onCountChange }: {
  source: InjurySource;
  parentId: string;
  canRecord: boolean;
  onCountChange?: (count: number) => void;
}) {
  const { t } = useTranslation();
  const zones = useZones();
  const label = useLabels();
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
          <span className="lbl">{t('injury.title')}</span>
        </div>
        {canRecord && <Btn sm v="p" onClick={() => setModalOpen(true)}><Icon name="plus" />{t('injury.record')}</Btn>}
      </div>

      <ErrorText err={err} />
      {loading ? (
        <p className="cap">{t('injury.loading')}</p>
      ) : items.length === 0 ? (
        <p className="cap">{canRecord ? t('injury.emptyCanRecord') : t('injury.empty')}</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
          <div>
            <HorseMap readOnly zones={zones} zone={active ? zoneOf(active.bodyRegion) : null} side={isRight(active?.side ?? null) ? 'R' : 'L'} />
            {active && !zoneOf(active.bodyRegion) && <p className="cap mt-1">{t('injury.offMap', { region: active.bodyRegion })}</p>}
          </div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {items.map((loc) => {
              const on = loc.id === active?.id;
              const side = label.side(loc.side);
              return (
                <li key={loc.id}>
                  <button type="button" onClick={() => setActiveId(loc.id)} aria-pressed={on}
                    className={`w-full text-left rounded-btn border px-3 py-2 bg-white ${on ? 'border-bad ring-1 ring-bad' : 'border-line hover:border-muted'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-[13px]">{label.region(loc.bodyRegion)}</strong>
                      {side && <span className="cap">· {side}</span>}
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
  const { t } = useTranslation();
  const zones = useZones();
  const [zone, setZone] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [side, setSide] = useState<Side>('LEFT');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const usingCustom = custom.trim() !== '';
  const zoneLabel = zone ? t(`injury.zones.${zone}`) : undefined;
  // What gets stored: free text as typed, or the canonical zone name.
  const bodyRegion = custom.trim() || BODY_ZONES.find((z) => z.key === zone)?.name || '';
  const shownRegion = usingCustom ? custom.trim() : zoneLabel;
  const sideLabel = side === 'RIGHT' ? t('injury.right') : t('injury.left');

  const reset = () => { setZone(null); setCustom(''); setSide('LEFT'); setNotes(''); setErr(null); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const pickZone = (k: string) => { setZone(k); setCustom(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bodyRegion) {
      setErr(new Error(t('injury.required')));
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
        title={t('injury.modalTitle')}
        sub={source === 'incidents' ? t('injury.modalSubIncident') : t('injury.modalSubRecord')} />
      <form onSubmit={submit}>
        <ModalBody>
          <ErrorText err={err} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="cap">{t('injury.mapHint')}</span>
            <Seg options={[['LEFT', t('injury.left')], ['RIGHT', t('injury.right')]]} value={side} onChange={(k) => setSide(k as Side)} />
          </div>
          <HorseMap zones={zones} zone={usingCustom ? null : zone} side={side === 'RIGHT' ? 'R' : 'L'}
            onZone={pickZone} label={usingCustom ? undefined : zoneLabel} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('injury.zonesAria')}>
            {zones.map((z) => {
              const on = zone === z.key && !usingCustom;
              return (
                <button key={z.key} type="button" onClick={() => pickZone(z.key)} aria-pressed={on}
                  className={`h-[26px] px-2.5 rounded-full border text-[12px] ${on ? 'bg-bad text-white border-bad' : 'bg-white text-ink border-line'}`}>
                  {z.name}
                </button>
              );
            })}
          </div>
          <Field label={t('injury.custom')} hint={t('injury.customHint')}>
            <Input value={custom} maxLength={120} onChange={(e) => setCustom(e.target.value)} placeholder={t('injury.customPlaceholder')} />
          </Field>
          <Field label={t('injury.notes')} hint={t('injury.notesHint')}>
            <Textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} placeholder={t('injury.notesPlaceholder')} />
          </Field>
          {shownRegion && (
            <p className="text-[13px]">{t('injury.willSave')} <strong>{shownRegion}</strong> · {sideLabel}</p>
          )}
        </ModalBody>
        <ModalFoot>
          <Btn onClick={close} disabled={busy}>{t('injury.cancel')}</Btn>
          <Btn v="p" type="submit" disabled={busy || !bodyRegion}>{busy ? t('injury.saving') : t('injury.save')}</Btn>
        </ModalFoot>
      </form>
    </Modal>
  );
}
