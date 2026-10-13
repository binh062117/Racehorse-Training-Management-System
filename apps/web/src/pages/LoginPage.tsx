import { useCallback, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { OtpRequiredError } from '../auth/context';
import { getLastEmail, setLastEmail } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OtpStep } from '../components/OtpStep';
import { EyeIcon, EyeOffIcon, HorseIcon } from '../components/Icons';
import './LoginPage.css';

interface LocationState {
  from?: { pathname: string };
}

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  pass: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Trainer', role: 'TRAINER', email: 'trainer@racehorse.local', pass: 'Trainer123!' },
  { label: 'Manager', role: 'MANAGER', email: 'manager@racehorse.local', pass: 'Manager123!' },
  { label: 'Veterinarian', role: 'VET', email: 'vet@racehorse.local', pass: 'Vet123!' },
  { label: 'Groom', role: 'GROOM', email: 'groom@racehorse.local', pass: 'Groom123!' },
  { label: 'Owner', role: 'OWNER', email: 'owner1@racehorse.local', pass: 'Owner123!' },
];

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => getLastEmail() ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [googleOtpEmail, setGoogleOtpEmail] = useState<string | null>(null);
  const [googleOtpDone, setGoogleOtpDone] = useState(false);

  const goAfterLogin = useCallback(() => {
    const dest = (location.state as LocationState | null)?.from?.pathname;
    navigate(dest ?? '/dashboard', { replace: true });
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

  const handleFillDemo = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setErr(null);
  };

  if (user) return <Navigate to="/dashboard" replace />;

  if (googleOtpDone) {
    return (
      <div className="auth-viewport">
        <div className="auth-form-column" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="auth-form-container" style={{ textAlign: 'center' }}>
            <div className="auth-brand" style={{ justifyContent: 'center', marginBottom: 20 }}>
              <div className="auth-brand-logo">
                <HorseIcon width={22} height={22} />
              </div>
              <span className="auth-brand-text">Racehorse Club</span>
            </div>
            <h1 className="auth-title">{t('auth.register')}</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>{t('auth.registerDone')}</p>
            <button
              type="button"
              className="auth-submit-btn"
              onClick={() => {
                setGoogleOtpEmail(null);
                setGoogleOtpDone(false);
              }}
            >
              {t('auth.login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (googleOtpEmail) {
    return (
      <div className="auth-viewport">
        <div className="auth-form-column" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="auth-form-container">
            <OtpStep
              email={googleOtpEmail}
              onVerified={() => setGoogleOtpDone(true)}
            />
          </div>
        </div>
      </div>
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
    <div className="auth-viewport">
      {/* ----------------- CỘT TRÁI: FORM ĐĂNG NHẬP ----------------- */}
      <section className="auth-form-column">
        {/* Brand Header */}
        <header className="auth-form-top">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-logo">
              <HorseIcon width={20} height={20} />
            </div>
            <span className="auth-brand-text">Racehorse Club</span>
          </Link>
        </header>

        {/* Center Content Form */}
        <div className="auth-form-container">
          <div className="auth-heading-group">
            <h1 className="auth-title">Chào mừng trở lại!</h1>
            <p className="auth-subtitle">
              Đăng nhập để truy cập trang điều hành và dữ liệu huấn luyện đàn ngựa.
            </p>
          </div>

          <form onSubmit={submit}>
            {/* Email Field */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="email-input">
                {t('auth.email')}
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  id="email-input"
                  className="auth-input"
                  type="email"
                  autoComplete="username"
                  placeholder="name@racehorse.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="password-input">
                {t('auth.password')}
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password-input"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu của bạn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
                </button>
              </div>
            </div>

            {/* Forgot password aux row */}
            <div className="auth-aux-row">
              <span className="auth-forgot-link" style={{ cursor: 'pointer' }} onClick={() => alert('Vui lòng liên hệ Quản lý CLB để được cấp lại mật khẩu.')}>
                Quên mật khẩu?
              </span>
            </div>

            <ErrorText err={err} />

            {/* Sign in Button */}
            <button type="submit" className="auth-submit-btn" disabled={busy}>
              {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Social Sign-in Divider */}
          <div className="auth-divider-line">
            <span>HOẶC</span>
          </div>

          {/* Google Sign-in */}
          <div className="auth-social-group">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleSignInButton onToken={onGoogleToken} />
            </div>
          </div>

          {/* Quick Demo Switch */}
          <div className="auth-demo-matrix">
            <div className="auth-demo-label">Đăng nhập nhanh tài khoản mẫu:</div>
            <div className="auth-demo-chips">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className="auth-demo-chip"
                  onClick={() => handleFillDemo(acc)}
                  title={`Đăng nhập vai trò ${acc.label}`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer prompt */}
          <p className="auth-footer-prompt">
            {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
          </p>
        </div>

        {/* Form bottom note */}
        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
          &copy; {new Date().getFullYear()} Racehorse Club Management System. Bảo mật theo tiêu chuẩn RBAC.
        </div>
      </section>

      {/* ----------------- CỘT PHẢI: HERO BRANDING / SOCIAL PROOF ----------------- */}
      <section className="auth-hero-column">
        <div>
          {/* Top category pill */}
          <div className="auth-hero-tag">
            <svg xmlns="http://www.w3.org/2000/svg" fill="#e3e5da" width="30px" height="30px" viewBox="0 0 48 48" data-name="Layer 1" id="Layer_1"><title/><path d="M40,47H8a2,2,0,0,1-2-2V3A2,2,0,0,1,8,1H40a2,2,0,0,1,2,2V45A2,2,0,0,1,40,47ZM10,43H38V5H10Z"/><path d="M15,19a2,2,0,0,1-1.41-3.41l4-4a2,2,0,0,1,2.31-.37l2.83,1.42,5-4.16A2,2,0,0,1,30.2,8.4l4,3a2,2,0,1,1-2.4,3.2l-2.73-2.05-4.79,4a2,2,0,0,1-2.17.25L19.4,15.43l-3,3A2,2,0,0,1,15,19Z"/><circle cx="15" cy="24" r="2"/><circle cx="15" cy="31" r="2"/><circle cx="15" cy="38" r="2"/><path d="M33,26H22a2,2,0,0,1,0-4H33a2,2,0,0,1,0,4Z"/><path d="M33,33H22a2,2,0,0,1,0-4H33a2,2,0,0,1,0,4Z"/><path d="M33,40H22a2,2,0,0,1,0-4H33a2,2,0,0,1,0,4Z"/></svg>
            Hệ thống Quản lý Huấn luyện & Y tế
          </div>
        </div>

        <div className="auth-hero-content">
          <h2 className="auth-hero-headline">
            Tối ưu hoá hiệu suất & bảo vệ thể lực chiến mã với AI.
          </h2>

          <div className="auth-hero-quote">
            <p>
              &ldquo;Hệ thống đã chuẩn hoá toàn diện quy trình kiểm tra y tế, tính toán khẩu phần dinh dưỡng và phát hiện chấn thương sớm, giúp đàn ngựa đạt đỉnh phong độ trước ngày thi đấu.&rdquo;
            </p>
          </div>

          <div className="auth-hero-author">
            <div className="auth-author-avatar">
              TH
            </div>
            <div className="auth-author-info">
              <span className="auth-author-name">Trainer One</span>
              <span className="auth-author-role">Huấn luyện viên Trưởng &bull; Royal Turf Club</span>
            </div>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="auth-hero-footer">
          <div className="auth-footer-tagline">Các phân hệ vận hành tự động</div>
          <div className="auth-metrics-grid">
            <div className="auth-metric-item">
              <span className="auth-metric-value">195 bpm</span>
              <span className="auth-metric-desc">Ngưỡng nhịp tim cảnh báo</span>
            </div>
            <div className="auth-metric-item">
              <span className="auth-metric-value">&plusmn;60 phút</span>
              <span className="auth-metric-desc">Chống xung đột lịch chạy</span>
            </div>
            <div className="auth-metric-item">
              <span className="auth-metric-value">3 Đời</span>
              <span className="auth-metric-desc">Phả hệ & thể trạng di truyền</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
