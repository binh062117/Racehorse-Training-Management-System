import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { OtpStep } from '../components/OtpStep';
import { PasswordInput } from '../components/PasswordInput';
import { AuthLayout } from '../ds/AuthLayout';
import { Btn, Field, Input } from '../ds/ui';

export function RegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setStep('otp');
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthLayout eyebrow={t('nav.brandName')} title={t('auth.register')}>
        <p>{t('auth.registerDone')}</p>
        <Link to="/login"><Btn v="p" className="w-full h-11">{t('auth.login')}</Btn></Link>
      </AuthLayout>
    );
  }

  if (step === 'otp') {
    return (
      <AuthLayout eyebrow={t('nav.brandName')} title={t('auth.register')}>
        <OtpStep email={email.trim()} onVerified={() => setStep('done')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow={t('nav.brandName')} title={t('auth.register')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('auth.email')}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorText err={err} />
        <Btn v="p" type="submit" className="w-full h-11" disabled={busy}>
          {t('auth.register')}
        </Btn>
      </form>
      <p className="cap text-center">
        <Link to="/login" className="font-semibold text-info no-underline">{t('auth.login')}</Link>
      </p>
    </AuthLayout>
  );
}
