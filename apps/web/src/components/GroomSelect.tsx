import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Paginated } from '../lib/types';
import { Btn, Field, NativeSelect } from '../ds/ui';
import { ErrorText } from './ErrorText';

export function GroomSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const all: typeof rows = [];
        for (let page = 1; ; page++) {
          const r = await api.get<Paginated<(typeof rows)[number]>>('/training/grooms', { params: { page, limit: 100 }, signal: controller.signal });
          all.push(...r.data.data);
          if (page * r.data.meta.limit >= r.data.meta.total) break;
        }
        if (!controller.signal.aborted) { setRows(all); setError(null); }
      } catch (e) { if (!controller.signal.aborted) setError(e); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [attempt]);
  return <Field label={t('hai.assignedGroom')}>
    <NativeSelect value={value} disabled={disabled || loading || !!error} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('hai.unassigned')}</option>
      {value && !rows.some((r) => r.id === value) && <option value={value}>{t('hai.unavailableGroom')}</option>}
      {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </NativeSelect>
    {loading && <span role="status">{t('ui.loading')}</span>}
    {!loading && !error && rows.length === 0 && <span className="cap">{t('hai.noGrooms')}</span>}
    <ErrorText err={error} />
    {!!error && <Btn sm onClick={() => { setLoading(true); setAttempt((n) => n + 1); }}>{t('healthView.retry')}</Btn>}
  </Field>;
}
