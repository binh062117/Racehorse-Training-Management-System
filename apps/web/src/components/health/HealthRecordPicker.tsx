import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { HealthRecord, Paginated } from '../../lib/types';
import { ErrorText } from '../ErrorText';
import { Btn, HealthBadge, Icon } from '../../ds/ui';
import { CreateHealthRecordModal } from './CreateHealthRecordModal';

/**
 * Pick the vet's exam that backs a decision (closing an incident, lifting a
 * training lock). Lists the horse's records newest first; records that cannot
 * back the decision are shown but disabled with the reason, and the vet can
 * write a new exam on the spot.
 */
export function HealthRecordPicker({
  horseId,
  horseName,
  value,
  onChange,
  requireFit = false,
  after,
  canCreate = false,
}: {
  horseId: string;
  horseName: string;
  value: string;
  onChange: (id: string) => void;
  /** Only an exam concluding "Khỏe mạnh" can be chosen. */
  requireFit?: boolean;
  /** Only exams written after this moment can be chosen (e.g. after the lock began). */
  after?: string | null;
  canCreate?: boolean;
}) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<HealthRecord>>(`/horses/${horseId}/health-records`, { params: { limit: 30 } });
      setRecords(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    }
  }, [horseId]);
  useEffect(() => { void load(); }, [load]);

  const why = (r: HealthRecord): string | null => {
    if (after && new Date(r.createdAt).getTime() < new Date(after).getTime()) return t('recordPicker.beforeLock');
    if (requireFit && r.healthStatus !== 'FIT') return t('recordPicker.notFit');
    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      <ErrorText err={err} />
      {records === null && !err ? (
        <p className="text-[13px] text-muted">{t('recordPicker.loading')}</p>
      ) : records && records.length === 0 ? (
        <p className="text-[13px] text-muted">{t('recordPicker.empty', { horse: horseName })}</p>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-1.5 max-h-[280px] overflow-y-auto" role="radiogroup" aria-label={t('recordPicker.label')}>
          {(records ?? []).map((r) => {
            const blocked = why(r);
            const on = value === r.id;
            return (
              <li key={r.id}>
                <label className={`flex items-start gap-3 rounded-btn border px-3 py-2.5 transition-colors ${on ? 'border-info bg-info-bg' : 'border-line'} ${blocked ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer hover:border-line-strong'}`}>
                  <input type="radio" name={`record-${horseId}`} className="mt-1 accent-[#1a4b8a]" checked={on} disabled={!!blocked} onChange={() => onChange(r.id)} />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="num font-medium">{formatDate(r.examDate)}</span>
                      {r.healthStatus ? <HealthBadge status={r.healthStatus} /> : <span className="text-[12px] text-muted">{t('recordPicker.noConclusion')}</span>}
                    </span>
                    <span className="block text-[13px] text-muted mt-0.5 line-clamp-2">{r.diagnosis}</span>
                    {blocked && <span className="block text-[12px] text-warn mt-0.5">{blocked}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {canCreate && (
        <Btn sm v="g" className="self-start -ml-2" onClick={() => setCreating(true)}>
          <Icon name="plus" className="w-3.5 h-3.5" />{t('recordPicker.createNew')}
        </Btn>
      )}
      {canCreate && (
        <CreateHealthRecordModal
          isOpen={creating}
          onClose={() => setCreating(false)}
          horseId={horseId}
          horseName={horseName}
          onCreated={(rec) => { void load().then(() => { if (!why({ ...rec })) onChange(rec.id); }); }}
        />
      )}
    </div>
  );
}
