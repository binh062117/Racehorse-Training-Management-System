import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Field } from '../components/Field';
import { ErrorText } from '../components/ErrorText';
import { OtpStep } from '../components/OtpStep';
import { PasswordInput } from '../components/PasswordInput';

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
      <div className="auth-card card">
        <h1>{t('auth.register')}</h1>
        <p>{t('auth.registerDone')}</p>
        <p className="muted">
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    );
  }

  if (step === 'otp') {
    return <OtpStep email={email.trim()} onVerified={() => setStep('done')} />;
  }

  return (
    <div className="auth-card card">
      <h1>{t('auth.register')}</h1>
      <form onSubmit={submit}>
        <Field label={t('auth.name')}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.email')}>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorText err={err} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('auth.register')}
        </button>
      </form>
      <p className="muted">
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </div>
  );
}
