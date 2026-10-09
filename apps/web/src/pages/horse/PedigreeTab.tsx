import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, Paginated, PedigreeNode } from '../../lib/types';
import { ErrorText } from '../../components/ErrorText';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import './PedigreeTab.css';

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
      .get<PedigreeNode>(`/horses/${horseId}/pedigree`, {
        signal: controller.signal,
      })
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
    <section className="pedigree card stack" aria-label={t('tab.pedigree')}>
      <div className="row pedigree-heading">
        <h2>{t('tab.pedigree')}</h2>
        {isManager && !loading && !err && tree && !editing && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            {t('pedigree.edit')}
          </button>
        )}
      </div>
      {saved && <p role="status">{t('pedigree.saved')}</p>}
      {isManager && !loading && !err && tree && editing && (
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
      )}
      {loading ? (
        <p className="muted" role="status">
          {t('pedigree.loading')}
        </p>
      ) : err ? (
        <div>
          <ErrorText err={err} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setLoading(true);
              setErr(null);
              setRevision((v) => v + 1);
            }}
          >
            {t('pedigree.retry')}
          </button>
        </div>
      ) : tree ? (
        <ul className="pedigree-tree">
          <Ancestor node={tree} label={t('pedigree.horse')} depth={3} />
        </ul>
      ) : null}
    </section>
  );
}

function Ancestor({
  node,
  label,
  depth,
}: {
  node: PedigreeNode | null;
  label: string;
  depth: number;
}) {
  const { t } = useTranslation();
  return (
    <li className={`pedigree-branch pedigree-level-${depth}`}>
      <div className={node ? 'pedigree-node' : 'pedigree-node pedigree-node-unknown'}>
        <div className="pedigree-node-label">{label}</div>
        <strong className="pedigree-node-name">
          {node && depth < 3 ? (
            <Link to={`/horses/${node.id}?tab=pedigree`}>{node.name}</Link>
          ) : (
            node?.name ?? t('pedigree.unknown')
          )}
        </strong>
        {node && (
          <dl className="pedigree-node-fitness">
            <dt>{t('pedigree.fitnessScore')}</dt>
            <dd>{node.fitnessScore ?? t('pedigree.unknown')}</dd>
          </dl>
        )}
      </div>
      {depth > 1 && node !== null && (
        <ul className="pedigree-generation">
          <Ancestor
            node={node?.sire ?? null}
            label={t('pedigree.sire')}
            depth={depth - 1}
          />
          <Ancestor
            node={node?.dam ?? null}
            label={t('pedigree.dam')}
            depth={depth - 1}
          />
        </ul>
      )}
    </li>
  );
}

function EditPedigree({
  horseId,
  onCancel,
  onSaved,
}: {
  horseId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
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
        const horse = await api.get<Horse>(`/horses/${horseId}`, {
          signal: controller.signal,
        });
        const candidates: Horse[] = [];
        let page = 1;
        while (!controller.signal.aborted) {
          const res = await api.get<Paginated<Horse>>('/horses', {
            params: { page, limit: 100 },
            signal: controller.signal,
          });
          candidates.push(...res.data.data);
          const { meta } = res.data;
          if (meta.page * meta.limit >= meta.total) break;
          page += 1;
        }
        if (controller.signal.aborted) return;
        setHorses(
          [...new Map(candidates.map((h) => [h.id, h])).values()].filter(
            (h) => h.id !== horseId,
          ),
        );
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
      await api.patch<Horse>(`/horses/${horseId}`, {
        sireId: sireId || null,
        damId: damId || null,
      });
      onSaved();
    } catch (error: unknown) {
      setSaveErr(error);
    } finally {
      setBusy(false);
    }
  };

  const options = (selectedId: string, otherId: string) => (
    <>
      <option value="">{t('pedigree.unknown')}</option>
      {selectedId && !horses.some((h) => h.id === selectedId) && (
        <option value={selectedId} disabled>
          {t('pedigree.unavailableParent', { id: selectedId })}
        </option>
      )}
      {horses.map((horse) => (
        <option key={horse.id} value={horse.id} disabled={horse.id === otherId}>
          {horse.name}
        </option>
      ))}
    </>
  );

  return (
    <form className="form-grid pedigree-editor" onSubmit={save}>
      <h2>{t('pedigree.edit')}</h2>
      {loading ? (
        <p className="muted" role="status">
          {t('pedigree.loading')}
        </p>
      ) : loadErr ? (
        <div>
          <ErrorText err={loadErr} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setLoading(true);
              setLoadErr(null);
              setAttempt((v) => v + 1);
            }}
          >
            {t('pedigree.retry')}
          </button>
        </div>
      ) : (
        <>
          <Field label={t('pedigree.sire')} hint={t('pedigree.clearHint')}>
            <select
              className="input"
              value={sireId}
              disabled={busy}
              onChange={(e) => {
                setSireId(e.target.value);
                setSaveErr(null);
              }}
            >
              {options(sireId, damId)}
            </select>
          </Field>
          <Field label={t('pedigree.dam')} hint={t('pedigree.clearHint')}>
            <select
              className="input"
              value={damId}
              disabled={busy}
              onChange={(e) => {
                setDamId(e.target.value);
                setSaveErr(null);
              }}
            >
              {options(damId, sireId)}
            </select>
          </Field>
          {sameParent && (
            <p className="error" role="alert">
              {t('pedigree.sameParent')}
            </p>
          )}
        </>
      )}
      <ErrorText err={saveErr} />
      <div className="row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || loading || !!loadErr || sameParent}
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          disabled={busy}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
