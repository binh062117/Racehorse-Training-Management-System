import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { AuthLayout } from '../ds/AuthLayout';
import { Btn, Field, Input } from '../ds/ui';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout eyebrow={t('auth.portalEyebrow')} title={t('auth.forgotPasswordTitle')}>
        <p>{t('auth.forgotPasswordSent')}</p>
        <Link to="/login"><Btn v="p" className="w-full h-11">{t('auth.backToLogin')}</Btn></Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow={t('auth.portalEyebrow')} title={t('auth.forgotPasswordTitle')} subtitle={t('auth.forgotPasswordSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.email')}>
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <ErrorText err={err} />
        <Btn v="p" type="submit" className="w-full h-11" disabled={busy}>
          {t('auth.forgotPasswordSubmit')}
        </Btn>
      </form>
      <p className="cap text-center">
        <Link to="/login" className="font-semibold text-info no-underline">{t('auth.backToLogin')}</Link>
      </p>
    </AuthLayout>
  );
}
