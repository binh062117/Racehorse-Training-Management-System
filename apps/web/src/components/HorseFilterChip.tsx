import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse } from '../lib/types';
import { Icon } from '../ds/ui';

/** `?horseId=` on a list page: the list is scoped to that one horse. */
export function useHorseFilter() {
  const [params, setParams] = useSearchParams();
  const horseId = params.get('horseId') ?? '';
  const [horseName, setHorseName] = useState('');
  useEffect(() => {
    if (!horseId) { setHorseName(''); return; }
    let live = true;
    api.get<Horse>(`/horses/${horseId}`)
      .then((r) => { if (live) setHorseName(r.data.name); })
      .catch(() => { if (live) setHorseName(''); });
    return () => { live = false; };
  }, [horseId]);
  const clear = () => {
    const next = new URLSearchParams(params);
    next.delete('horseId');
    setParams(next, { replace: true });
  };
  return { horseId, horseName, clear };
}

export function HorseFilterChip({ horseId, horseName, onClear }: { horseId: string; horseName: string; onClear: () => void }) {
  const { t } = useTranslation();
  if (!horseId) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-info-bd bg-info-bg text-info-ink pl-3 pr-1 py-1 text-[13px] w-fit">
      <Icon name="search" className="w-3.5 h-3.5" />
      <span>{t('horseFilter.only')} <b>{horseName || '…'}</b></span>
      <button type="button" onClick={onClear} aria-label={t('horseFilter.clear')} title={t('horseFilter.clear')}
        className="w-6 h-6 rounded-full inline-flex items-center justify-center hover:bg-white cursor-pointer">
        <Icon name="x" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
