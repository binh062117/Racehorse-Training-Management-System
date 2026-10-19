import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { AuthLayout } from '../ds/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { Btn, Field } from '../ds/ui';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthLayout eyebrow={t('auth.portalEyebrow')} title={t('auth.resetPasswordTitle')}>
        <p>{t('auth.resetPasswordInvalidLink')}</p>
        <Link to="/forgot-password"><Btn v="p" className="w-full h-11">{t('auth.forgotPasswordTitle')}</Btn></Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout eyebrow={t('auth.portalEyebrow')} title={t('auth.resetPasswordTitle')}>
        <p>{t('auth.resetPasswordDone')}</p>
        <Link to="/login"><Btn v="p" className="w-full h-11">{t('auth.goToLogin')}</Btn></Link>
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow={t('auth.portalEyebrow')} title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
          <PasswordInput autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </Field>
        <ErrorText err={err} />
        <Btn v="p" type="submit" className="w-full h-11" disabled={busy}>
          {t('auth.resetPasswordSubmit')}
        </Btn>
      </form>
    </AuthLayout>
  );
}
