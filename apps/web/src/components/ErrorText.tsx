import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorMessage } from '../lib/api';

// A server message with Vietnamese letters was written for the user (e.g. the
// EX-01 clash with the exact session time) — show it as is. English ones are
// developer text, so fall back to the translated message for the error code.
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

export function ErrorText({ err }: { err: unknown }) {
  const { t, i18n } = useTranslation();
  if (!err) return null;
  const code = apiErrorCode(err);
  const key = `error.${code}`;
  const server = apiErrorMessage(err);
  const translated = i18n.exists(key) ? t(key) : null;
  const text = server && VIETNAMESE.test(server) ? server : translated ?? server ?? t('error.INTERNAL');
  return (
    <p className="text-bad font-medium text-[13px]" role="alert">
      {text}
    </p>
  );
}
