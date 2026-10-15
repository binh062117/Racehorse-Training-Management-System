import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorMessage } from '../lib/api';

export function ErrorText({ err }: { err: unknown }) {
  const { t, i18n } = useTranslation();
  if (!err) return null;
  const code = apiErrorCode(err);
  const key = `error.${code}`;
  const translated = i18n.exists(key) ? t(key) : null;
  return (
    <p className="text-bad font-medium text-[13px]" role="alert">
      {translated ?? apiErrorMessage(err) ?? t('error.INTERNAL')}
    </p>
  );
}
