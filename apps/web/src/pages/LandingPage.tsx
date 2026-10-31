import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { setLanguage } from '../i18n';
import { Badge, Cloth, HORSE_LOGO, Icon, type Tone } from '../ds/ui';

/** `/`: signed-in people go straight to work; everyone else meets the club first. */
export function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <p className="cap text-center pt-10">…</p>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

const ROLES = ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER'] as const;
const ROLE_ICON: Record<(typeof ROLES)[number], string> = { MANAGER: 'dashboard', TRAINER: 'plans', VET: 'heart', GROOM: 'horse', OWNER: 'user' };

// The interface fragment in the hero — a real piece of the app's stable board,
// filled with sample horses so a visitor sees what the work looks like.
const SAMPLE_BOARD: { n: number; name: string; meta: string; tone: Tone; state: string; reason: string; fit: number | null }[] = [
  { n: 4, name: 'Blue Comet', meta: 'Thoroughbred', tone: 'ok', state: 'ready', reason: '', fit: 82 },
  { n: 6, name: 'Royal Thunder', meta: 'Thoroughbred', tone: 'warn', state: 'light', reason: 'monitoringReason', fit: 78 },
  { n: 1, name: 'Black Pearl', meta: 'Thoroughbred', tone: 'lock', state: 'locked', reason: 'sampleLockReason', fit: 60 },
  { n: 7, name: 'Lucky Star', meta: 'Arabian', tone: 'ok', state: 'ready', reason: '', fit: 92 },
];
const fitColor = (v: number) => (v >= 80 ? '#247b50' : v >= 60 ? '#b45309' : '#c4242a');

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');
  const flows = ['horses', 'training', 'health', 'races', 'supplies'] as const;
  const flowIcon: Record<(typeof flows)[number], string> = { horses: 'horse', training: 'plans', health: 'heart', races: 'flag', supplies: 'box' };

  return (
    <div className="min-h-screen bg-page text-ink">
      {/* ---------- top bar ---------- */}
      <header className="bg-navy text-white">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-white overflow-hidden flex items-center justify-center flex-none">
            <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain scale-[1.3]" />
          </span>
          <span className="font-semibold">Racehorse Club</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setLanguage(isVi ? 'en' : 'vi')} className="h-8 px-2 rounded-btn text-[13px] text-[#c3cbd6] hover:text-white hover:bg-white/[.08]">
            {isVi ? 'EN' : 'VI'}
          </button>
          <Link to="/login" className="h-9 px-3.5 rounded-btn inline-flex items-center text-[13.5px] font-medium text-white hover:bg-white/[.08] no-underline">{t('landing.login')}</Link>
          <Link to="/register" className="hidden sm:inline-flex h-9 px-3.5 rounded-btn items-center text-[13.5px] font-medium bg-white text-navy hover:bg-cream no-underline">{t('landing.register')}</Link>
        </div>
      </header>

      {/* ---------- hero: the claim, and the screen that proves it ---------- */}
      <section className="relative overflow-hidden bg-navy text-white">
        <svg aria-hidden viewBox="0 0 980 760" className="pointer-events-none absolute -left-[380px] -bottom-[420px] w-[980px] h-[760px] opacity-70">
          <g fill="none" stroke="#f5f4f1">
            <rect x="40" y="120" width="900" height="520" rx="260" strokeOpacity="0.12" strokeWidth="2" />
            <rect x="124" y="192" width="732" height="376" rx="188" strokeOpacity="0.08" strokeWidth="1.5" />
            <rect x="208" y="264" width="564" height="232" rx="116" strokeOpacity="0.12" strokeWidth="2" />
          </g>
          <rect x="124" y="192" width="732" height="376" rx="188" fill="none" stroke="#5b9bd5" strokeWidth="3" strokeLinecap="round" pathLength={1000} strokeDasharray="220 780" />
        </svg>
        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
          <div>
            <h1 className="text-[34px] sm:text-[44px] lg:text-[54px] leading-[1.06] font-semibold tracking-[-0.025em]">
              {t('landing.heroA')} <span className="text-[#5b9bd5]">{t('landing.heroB')}</span>
            </h1>
            <p className="mt-5 max-w-[540px] text-[16px] lg:text-[18px] leading-relaxed text-[#c3cbd6]">{t('landing.heroSub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="h-11 px-5 rounded-btn inline-flex items-center gap-2 font-medium bg-[#1a4b8a] hover:bg-[#163e72] text-white no-underline shadow-[0_8px_22px_rgba(26,75,138,.45)]">
                {t('landing.ctaRegister')}<Icon name="chevRight" className="w-4 h-4 nudge" />
              </Link>
              <Link to="/login" className="h-11 px-5 rounded-btn inline-flex items-center font-medium border border-white/25 text-white hover:bg-white/[.08] no-underline">{t('landing.ctaLogin')}</Link>
            </div>
            <p className="mt-4 text-[13px] text-[#aab4c2]">{t('landing.ctaNote')}</p>
          </div>

          {/* A crop of the real "Bảng chuồng hôm nay" board. */}
          <figure className="m-0 lg:translate-x-6">
            <div className="rounded-card bg-white text-ink shadow-[0_30px_70px_rgba(5,12,22,.45)] overflow-hidden lg:rotate-[-1deg]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
                <span className="text-[15px] font-semibold">{t('dashboard.boardTitle', 'Bảng chuồng hôm nay')}</span>
                <span className="text-[12.5px] text-muted">{t('landing.sampleDate')}</span>
              </div>
              <ul className="list-none m-0 p-0">
                {SAMPLE_BOARD.map((h) => (
                  <li key={h.name} className="hover-hop grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3 border-b border-line-soft last:border-0">
                    <Cloth n={h.n} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{h.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge tone={h.tone}>{h.tone === 'lock' && <Icon name="lock" className="w-3 h-3" />}{t(`readiness.${h.state}`)}</Badge>
                        {h.reason && <span className="text-[12.5px] text-muted truncate">{t(h.reason === 'monitoringReason' ? 'readiness.monitoringReason' : 'landing.sampleLockReason')}</span>}
                      </div>
                    </div>
                    <span className="num text-[13px]"><span className="hop font-semibold" style={{ color: h.fit != null ? fitColor(h.fit) : undefined }}>{h.fit}</span><span className="text-muted">/100</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="mt-3 text-[12.5px] text-[#aab4c2] lg:pl-6">{t('landing.figcaption')}</figcaption>
          </figure>
        </div>
      </section>

      {/* ---------- what the club runs on it ---------- */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-semibold tracking-[-0.015em] max-w-[620px]">{t('landing.flowsTitle')}</h2>
        <p className="mt-3 text-[16px] text-muted max-w-[620px]">{t('landing.flowsSub')}</p>
        <div className="mt-10 grid gap-px bg-line rounded-card overflow-hidden border border-line sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((f) => (
            <article key={f} className="lift bg-white p-6">
              <span className="text-info"><Icon name={flowIcon[f]} className="w-6 h-6" /></span>
              <h3 className="mt-4 text-[17px] font-semibold">{t(`landing.flow.${f}.title`)}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t(`landing.flow.${f}.body`)}</p>
            </article>
          ))}
          <article className="bg-subtle p-6 flex flex-col justify-between">
            <p className="text-[15px] leading-relaxed">{t('landing.flowSafety')}</p>
            <Link to="/register" className="mt-4 text-info font-medium no-underline inline-flex items-center gap-1">{t('landing.ctaRegister')}<Icon name="chevRight" className="w-4 h-4 nudge" /></Link>
          </article>
        </div>
      </section>

      {/* ---------- who uses it ---------- */}
      <section className="bg-white border-y border-line">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 lg:py-20 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[28px] lg:text-[34px] leading-tight font-semibold tracking-[-0.015em]">{t('landing.rolesTitle')}</h2>
            <p className="mt-3 text-[16px] text-muted">{t('landing.rolesSub')}</p>
          </div>
          <ul className="list-none m-0 p-0 divide-y divide-line">
            {ROLES.map((r) => (
              <li key={r} className="flex gap-4 py-4 first:pt-0">
                <span className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center flex-none"><Icon name={ROLE_ICON[r]} className="w-4 h-4" /></span>
                <div>
                  <div className="font-semibold">{t(`role.${r}`)}</div>
                  <p className="text-[14.5px] text-muted mt-0.5">{t(`landing.roleDo.${r}`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- how to join ---------- */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-semibold tracking-[-0.015em]">{t('landing.stepsTitle')}</h2>
        <ol className="mt-10 list-none m-0 p-0 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="relative pl-14">
              <span className="absolute left-0 top-0 w-10 h-10 rounded-full border-2 border-info text-info font-semibold flex items-center justify-center num">{n}</span>
              <h3 className="text-[17px] font-semibold">{t(`landing.step${n}.title`)}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{t(`landing.step${n}.body`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-card bg-navy text-white px-6 py-8 sm:px-10 flex flex-wrap items-center gap-6">
          <p className="flex-1 min-w-[240px] text-[20px] font-semibold leading-snug">{t('landing.finalCta')}</p>
          <Link to="/login" className="h-11 px-5 rounded-btn inline-flex items-center font-medium bg-white text-navy hover:bg-cream no-underline">{t('landing.login')}</Link>
          <Link to="/register" className="h-11 px-5 rounded-btn inline-flex items-center font-medium border border-white/25 text-white hover:bg-white/[.08] no-underline">{t('landing.ctaRegister')}</Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <img src={HORSE_LOGO} alt="" className="w-6 h-6 object-contain" />
          <span>© {new Date().getFullYear()} Racehorse Club · SWP391</span>
          <span className="flex-1" />
          <Link to="/login" className="text-muted hover:text-ink no-underline">{t('landing.login')}</Link>
        </div>
      </footer>
    </div>
  );
}
