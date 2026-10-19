import { useTranslation } from 'react-i18next';
import { localizedError } from '../lib/localizedError';

export function ErrorText({ err }: { err: unknown }) {
  useTranslation();
  if (!err) return null;
  return (
    <p className="text-bad font-medium text-[13px]" role="alert">
      {localizedError(err)}
    </p>
  );
}
