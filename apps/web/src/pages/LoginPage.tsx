import { useCallback, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { OtpRequiredError } from '../auth/context';
import { getLastEmail, setLastEmail } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OtpStep } from '../components/OtpStep';
import { PasswordInput } from '../components/PasswordInput';
import { AuthLayout } from '../ds/AuthLayout';
import { Btn, Field, Input } from '../ds/ui';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => getLastEmail() ?? '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [googleOtpEmail, setGoogleOtpEmail] = useState<string | null>(null);
  const [googleOtpDone, setGoogleOtpDone] = useState(false);

  const goAfterLogin = useCallback(() => {
    const dest = (location.state as LocationState | null)?.from?.pathname;
    navigate(dest ?? '/horses', { replace: true });
  }, [location.state, navigate]);

  const onGoogleToken = useCallback(
    async (idToken: string) => {
      setErr(null);
      try {
        await loginWithGoogle(idToken);
        goAfterLogin();
      } catch (e2) {
        if (e2 instanceof OtpRequiredError) {
          setGoogleOtpEmail(e2.email);
          return;
        }
        setErr(e2);
      }
    },
    [loginWithGoogle, goAfterLogin],
  );

  if (user) return <Navigate to="/horses" replace />;

  if (googleOtpDone) {
    return (
      <AuthLayout eyebrow={t('nav.brandName')} title={t('auth.register')}>
        <p>{t('auth.registerDone')}</p>
        <Btn v="p" onClick={() => { setGoogleOtpEmail(null); setGoogleOtpDone(false); }}>{t('auth.login')}</Btn>
      </AuthLayout>
    );
  }

  if (googleOtpEmail) {
    return (
      <AuthLayout eyebrow={t('nav.brandName')} title={t('auth.register')}>
        <OtpStep email={googleOtpEmail} onVerified={() => setGoogleOtpDone(true)} />
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);
      setLastEmail(trimmedEmail);
      goAfterLogin();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow={t('nav.brandSystem')} title={t('auth.login')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.email')}>
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.password')}>
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorText err={err} />
        <Btn v="p" type="submit" className="w-full h-11" disabled={busy}>
          {t('auth.login')}
        </Btn>
      </form>
      <div className="flex items-center gap-3 text-muted text-[12px]">
        <span className="flex-1 h-px bg-line" />{t('auth.or')}<span className="flex-1 h-px bg-line" />
      </div>
      <div className="flex justify-center">
        <GoogleSignInButton onToken={onGoogleToken} />
      </div>
      <p className="cap text-center">
        {t('auth.noAccount')} <Link to="/register" className="font-semibold text-info no-underline">{t('auth.register')}</Link>
      </p>
    </AuthLayout>
  );
}
