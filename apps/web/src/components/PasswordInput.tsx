import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useState, type InputHTMLAttributes } from 'react';
import { Icon } from '../ds/ui';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Password input with a show/hide toggle button. */
export function PasswordInput(props: Props) {
  useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="h-10 w-full rounded-btn border border-line bg-white pl-3 pr-10 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? i18n.t("ui.hidePassword") : i18n.t("ui.showPassword")}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-muted hover:text-ink"
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} className="w-4 h-4" />
      </button>
    </div>
  );
}
