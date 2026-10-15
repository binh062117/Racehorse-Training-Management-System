import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from './ErrorText';
import { Btn, Field, Input } from '../ds/ui';

export function OtpStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/verify-otp', { email, code: code.trim() });
      onVerified();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(null);
    setResent(false);
    setBusy(true);
    try {
      await api.post('/auth/resend-otp', { email });
      setResent(true);
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-semibold text-[15px]">{t('auth.otpTitle')}</h2>
      <p className="cap mt-1">{t('auth.otpHint', { email })}</p>
      <form onSubmit={submit} className="flex flex-col gap-3.5 mt-3.5">
        <Field label={t('auth.otpCode')}>
          <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
        <ErrorText err={err} />
        {resent && <p className="cap">{t('auth.otpResent')}</p>}
        <div className="flex gap-2">
          <Btn v="p" type="submit" disabled={busy}>{t('auth.otpVerify')}</Btn>
          <Btn disabled={busy} onClick={() => void resend()}>{t('auth.otpResend')}</Btn>
        </div>
      </form>
    </div>
  );
}
