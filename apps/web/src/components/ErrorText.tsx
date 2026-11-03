import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { apiErrorCode, apiErrorMessage } from '../lib/api';

export function ErrorText({ err }: { err: unknown }) {
  const { t, i18n } = useTranslation();
  if (!err) return null;
  const code = apiErrorCode(err);
  const key = `error.${code}`;
  const translated = i18n.exists(key) ? t(key) : null;
  const message = isAxiosError(err)
    ? (i18n.resolvedLanguage === 'vi' ? apiErrorMessage(err) ?? translated : translated)
    : err instanceof Error ? err.message : null;
  return (
    <p className="text-bad font-medium text-[13px]" role="alert">
      {message ?? translated ?? t('error.INTERNAL')}
    </p>
  );
}
