import { useTranslation } from 'react-i18next';
import { Btn } from '../ds/ui';

export function Pagination({ page, total, onPage, limit = 20, disabled = false }: {
  page: number; total: number; onPage: (page: number) => void; limit?: number; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / limit));
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n > 0 && n <= pages).sort((a, b) => a - b);
  return <nav aria-label={t('hai.pagination')} className="flex flex-wrap items-center gap-2 p-4">
    <span className="cap" aria-live="polite">{t('hai.page', { page, pages, total })}</span>
    <Btn sm disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>{t('hai.previous')}</Btn>
    {numbers.map((n) => <Btn key={n} sm disabled={disabled} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</Btn>)}
    <Btn sm disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>{t('hai.next')}</Btn>
  </nav>;
}
