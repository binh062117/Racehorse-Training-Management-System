import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, Paginated, PedigreeNode } from '../../lib/types';
import { ErrorText } from '../../components/ErrorText';
import { useAuth } from '../../auth/useAuth';
import { Btn, Card, Field } from '../../ds/ui';

interface PedigreeTabProps {
  horseId: string;
  onUpdated?: () => void;
}

export function PedigreeTab({ horseId, onUpdated }: PedigreeTabProps) {
  return <PedigreeContent key={horseId} horseId={horseId} onUpdated={onUpdated} />;
}

function PedigreeContent({ horseId, onUpdated }: PedigreeTabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tree, setTree] = useState<PedigreeNode | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<PedigreeNode>(`/horses/${horseId}/pedigree`, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setTree(res.data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setTree(null);
          setErr(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [horseId, revision]);

  return (
    <Card className="p-5 min-w-0" aria-label={t('tab.pedigree')}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold">{t('tab.pedigree')}</h2>
        {isManager && !loading && !err && tree && !editing && (
          <Btn sm onClick={() => { setSaved(false); setEditing(true); }}>{t('pedigree.edit')}</Btn>
        )}
      </div>
      {saved && <p className="cap mt-2" role="status">{t('pedigree.saved')}</p>}

      {isManager && !loading && !err && tree && editing && (
        <div className="mt-4">
          <EditPedigree
            horseId={horseId}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              setSaved(true);
              setLoading(true);
              setErr(null);
              setRevision((v) => v + 1);
              onUpdated?.();
            }}
          />
        </div>
      )}

      {loading ? (
        <p className="cap mt-3" role="status">{t('pedigree.loading')}</p>
      ) : err ? (
        <div className="mt-3">
          <ErrorText err={err} />
          <Btn sm className="mt-2" onClick={() => { setLoading(true); setErr(null); setRevision((v) => v + 1); }}>{t('pedigree.retry')}</Btn>
        </div>
      ) : tree ? (
        <ul className="list-none p-0 m-0 flex flex-col items-center mt-5">
          <Ancestor node={tree} label={t('pedigree.horse')} depth={3} />
        </ul>
      ) : null}
    </Card>
  );
}

function Ancestor({ node, label, depth }: { node: PedigreeNode | null; label: string; depth: number }) {
  const { t } = useTranslation();
  const nodeBox = depth === 3
    ? 'border-navy bg-subtle w-full sm:w-1/2 mx-auto'
    : node
      ? (depth === 2 ? 'border-line-strong' : 'border-line')
      : 'border-line bg-subtle text-muted';

  return (
    <li className="min-w-0 flex flex-col items-center">
      <div className={`px-3.5 py-3 rounded-card border bg-white text-center ${nodeBox}`}>
        <div className="lbl">{label}</div>
        <strong className={`block mt-1 ${depth === 3 ? 'text-[15px] text-navy' : 'text-[13.5px]'} ${depth === 1 ? 'font-medium' : 'font-semibold'}`}>
          {node && depth < 3 ? <Link to={`/horses/${node.id}?tab=pedigree`} className="hover:underline">{node.name}</Link> : (node?.name ?? t('pedigree.unknown'))}
        </strong>
        {node && (
          <dl className="flex justify-center flex-wrap gap-x-2 gap-y-1 mt-2">
            <dt className="cap">{t('pedigree.fitnessScore')}</dt>
            <dd className="num text-[12.5px] m-0">{node.fitnessScore ?? t('pedigree.unknown')}</dd>
          </dl>
        )}
      </div>
      {depth > 1 && node !== null && (
        <ul className="list-none p-0 m-0 grid grid-cols-2 gap-4 mt-6">
          <Ancestor node={node?.sire ?? null} label={t('pedigree.sire')} depth={depth - 1} />
          <Ancestor node={node?.dam ?? null} label={t('pedigree.dam')} depth={depth - 1} />
        </ul>
      )}
    </li>
  );
}

function EditPedigree({ horseId, onCancel, onSaved }: { horseId: string; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [sireId, setSireId] = useState('');
  const [damId, setDamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [saveErr, setSaveErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        // Read raw IDs: a null tree branch may be traversal truncation, not
        // an absent relationship. Never initialize edits from the tree.
        const horse = await api.get<Horse>(`/horses/${horseId}`, { signal: controller.signal });
        const candidates: Horse[] = [];
        let page = 1;
        while (!controller.signal.aborted) {
          const res = await api.get<Paginated<Horse>>('/horses', { params: { page, limit: 100 }, signal: controller.signal });
          candidates.push(...res.data.data);
          const { meta } = res.data;
          if (meta.page * meta.limit >= meta.total) break;
          page += 1;
        }
        if (controller.signal.aborted) return;
        setHorses([...new Map(candidates.map((h) => [h.id, h])).values()].filter((h) => h.id !== horseId));
        setSireId(horse.data.sireId ?? '');
        setDamId(horse.data.damId ?? '');
      } catch (error: unknown) {
        if (!controller.signal.aborted) setLoadErr(error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [horseId, attempt]);

  const sameParent = sireId !== '' && sireId === damId;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || loading || loadErr || sameParent) return;
    setSaveErr(null);
    setBusy(true);
    try {
      // Both fields are deliberate: backend validation compares submitted IDs.
      await api.patch<Horse>(`/horses/${horseId}`, { sireId: sireId || null, damId: damId || null });
      onSaved();
    } catch (error: unknown) {
      setSaveErr(error);
    } finally {
      setBusy(false);
    }
  };

  const selectCls = 'h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15 disabled:bg-cream disabled:text-muted';
  const options = (selectedId: string, otherId: string) => (
    <>
      <option value="">{t('pedigree.unknown')}</option>
      {selectedId && !horses.some((h) => h.id === selectedId) && (
        <option value={selectedId} disabled>{t('pedigree.unavailableParent', { id: selectedId })}</option>
      )}
      {horses.map((horse) => (
        <option key={horse.id} value={horse.id} disabled={horse.id === otherId}>{horse.name}</option>
      ))}
    </>
  );

  return (
    <form onSubmit={save}>
      <Card className="p-4 flex flex-col gap-3.5 bg-subtle">
        <h2 className="text-[15px] font-semibold">{t('pedigree.edit')}</h2>
        {loading ? (
          <p className="cap" role="status">{t('pedigree.loading')}</p>
        ) : loadErr ? (
          <div>
            <ErrorText err={loadErr} />
            <Btn sm className="mt-2" onClick={() => { setLoading(true); setLoadErr(null); setAttempt((v) => v + 1); }}>{t('pedigree.retry')}</Btn>
          </div>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
            <Field label={t('pedigree.sire')} hint={t('pedigree.clearHint')}>
              <select className={selectCls} value={sireId} disabled={busy} onChange={(e) => { setSireId(e.target.value); setSaveErr(null); }}>
                {options(sireId, damId)}
              </select>
            </Field>
            <Field label={t('pedigree.dam')} hint={t('pedigree.clearHint')}>
              <select className={selectCls} value={damId} disabled={busy} onChange={(e) => { setDamId(e.target.value); setSaveErr(null); }}>
                {options(damId, sireId)}
              </select>
            </Field>
          </div>
        )}
        {sameParent && <p className="text-bad font-medium text-[13px]" role="alert">{t('pedigree.sameParent')}</p>}
        <ErrorText err={saveErr} />
        <div className="flex gap-2">
          <Btn v="p" sm type="submit" disabled={busy || loading || !!loadErr || sameParent}>{t('common.save')}</Btn>
          <Btn sm onClick={onCancel} disabled={busy}>{t('common.cancel')}</Btn>
        </div>
      </Card>
    </form>
  );
}
