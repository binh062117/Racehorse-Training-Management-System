import { useCallback, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { OtpRequiredError } from '../auth/context';
import { getLastEmail, setLastEmail } from '../lib/api';
import { Field } from '../components/Field';
import { ErrorText } from '../components/ErrorText';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OtpStep } from '../components/OtpStep';
import { PasswordInput } from '../components/PasswordInput';

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
      <div className="auth-card card">
        <h1>{t('auth.register')}</h1>
        <p>{t('auth.registerDone')}</p>
        <p className="muted">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setGoogleOtpEmail(null);
              setGoogleOtpDone(false);
            }}
          >
            {t('auth.login')}
          </button>
        </p>
      </div>
    );
  }

  if (googleOtpEmail) {
    return (
      <OtpStep
        email={googleOtpEmail}
        onVerified={() => setGoogleOtpDone(true)}
      />
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
    <div className="auth-card card">
      <h1>{t('auth.login')}</h1>
      <form onSubmit={submit}>
        <Field label={t('auth.email')}>
          <input
            className="input"
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
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('auth.login')}
        </button>
      </form>
      <div className="auth-divider">{t('auth.or')}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleSignInButton onToken={onGoogleToken} />
      </div>
      <p className="muted">
        {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
      </p>
    </div>
  );
}
