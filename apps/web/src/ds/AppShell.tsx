import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode,
} from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Notification, Paginated, Role } from '../lib/types';
import { setLanguage } from '../i18n';
import { Icon } from './ui';

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { to: '/horses', labelKey: 'nav.horses', icon: 'horse' },
  { to: '/plans', labelKey: 'nav.plans', icon: 'plans' },
  { to: '/races', labelKey: 'nav.races', icon: 'flag', roles: ['MANAGER', 'TRAINER', 'OWNER'] },
  { to: '/vaccinations', labelKey: 'nav.vaccinations', icon: 'syringe', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
  { to: '/health-records', labelKey: 'nav.healthRecords', icon: 'steth', roles: ['VET'] },
  { to: '/incidents', labelKey: 'nav.incidents', icon: 'alert', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', labelKey: 'nav.rbac', icon: 'user', roles: ['MANAGER'] },
];

function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const visible = (item: NavItem) => !item.roles || (role && item.roles.includes(role));
  return (
    <nav aria-label={t('dashboard.navigation')} className="flex flex-col gap-0.5 px-3 py-[18px] text-hero-line bg-navy flex-[1_1_240px] max-w-full md:flex-[0_0_240px]"
      style={{ backgroundImage: 'radial-gradient(120% 60% at 0% 100%, rgba(90,135,200,.14), transparent 60%)' }}>
      <Link to="/dashboard" className="flex items-center gap-2.5 px-2 pb-[18px] no-underline">
        <span className="w-[34px] h-[34px] rounded-full bg-cream text-navy flex items-center justify-center text-xs font-bold tracking-wider">RH</span>
        <span><span className="block text-white font-semibold text-[13.5px] leading-[18px]">{t('nav.brandName')}</span><span className="block text-[11px] leading-[14px] text-slate-400">{t('nav.brandSystem')}</span></span>
      </Link>
      <div className="px-3 pt-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[.08em] uppercase text-[#7c8aa0]">{t('nav.operation')}</div>
      {NAV.filter(visible).map(({ to, labelKey, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2.5 h-10 px-3 rounded-btn no-underline ${isActive ? 'bg-white/[.12] text-white font-semibold ring-1 ring-inset ring-white/[.08]' : 'text-hero-line font-medium hover:bg-white/[.07] hover:text-white'}`}>
          <Icon name={icon} />{t(labelKey)}
        </NavLink>
      ))}
      {ADMIN_NAV.some(visible) && (
        <>
          <div className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[.08em] uppercase text-[#7c8aa0]">{t('nav.administration')}</div>
          {ADMIN_NAV.filter(visible).map(({ to, labelKey, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2.5 h-10 px-3 rounded-btn no-underline ${isActive ? 'bg-white/[.12] text-white font-semibold ring-1 ring-inset ring-white/[.08]' : 'text-hero-line font-medium hover:bg-white/[.07] hover:text-white'}`}>
              <Icon name={icon} />{t(labelKey)}
            </NavLink>
          ))}
        </>
      )}
      <div className="mt-auto pt-3.5 px-3 border-t border-white/[.08] text-[11.5px] text-slate-400">{user?.name}</div>
    </nav>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

const POLL_MS = 20_000;

function Notifications() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useOutside(ref, () => setOpen(false));

  const load = useCallback(async () => {
    try {
      const [recentRes, unreadRes] = await Promise.all([
        api.get<Paginated<Notification>>('/notifications', { params: { type: 'AI_RISK_ALERT', limit: 6 } }),
        api.get<Paginated<Notification>>('/notifications', { params: { type: 'AI_RISK_ALERT', unread: true, limit: 1 } }),
      ]);
      setItems(recentRes.data.data);
      setUnreadCount(unreadRes.data.meta.total);
    } catch {
      // bell just shows stale data until the next poll
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const onChanged = () => void load();
    window.addEventListener('notifications:changed', onChanged);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:changed', onChanged);
    };
  }, [load]);

  const markReadAndGo = async (n: Notification) => {
    setOpen(false);
    if (!n.read) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        window.dispatchEvent(new Event('notifications:changed'));
      } catch {
        // non-critical
      }
    }
    navigate('/notifications');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={t('nav.notificationCount', { count: unreadCount })} aria-expanded={open} onClick={() => setOpen(!open)}
        className={`relative w-10 h-10 rounded-btn border bg-white inline-flex items-center justify-center ${unreadCount > 0 ? 'border-bad text-bad animate-live' : 'border-line text-ink'}`}>
        <Icon name="bell" />{unreadCount > 0 && <span className="absolute top-2 right-[9px] w-2 h-2 rounded-full bg-bad border-2 border-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[360px] bg-white border border-line rounded-xl shadow-pop overflow-hidden">
          <div className="flex items-center px-4 py-3.5 border-b border-line-soft"><span className="flex-1 font-semibold text-[15px]">{t('nav.aiAlerts')}</span>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-[11.5px] font-semibold text-info no-underline">{t('dashboard.viewAll')}</Link></div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted text-[12.5px]">{t('nav.noAlerts')}</div>
          ) : items.map((n) => (
            <button key={n.id} type="button" onClick={() => void markReadAndGo(n)}
              className={`w-full text-left flex gap-3 px-4 py-3 border-b border-line-soft ${!n.read ? 'bg-subtle' : 'bg-white'}`}>
              <span className="w-8 h-8 rounded-btn flex items-center justify-center flex-none bg-bad-bg text-bad"><Icon name="alert" /></span>
              <span className="flex-1 min-w-0"><span className="block font-semibold line-clamp-2">{n.message}</span><span className="cap num">{formatDateTime(n.createdAt)}</span></span>
              {!n.read && <span className="w-2 h-2 rounded-full bg-info mt-1.5 flex-none" aria-label={t('notificationsPage.unread')} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const initials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    if (!window.confirm(t('nav.logoutConfirm'))) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-muted text-[12px]" role="group" aria-label={t('nav.language')}>
        <button type="button" className="hover:text-ink disabled:text-navy disabled:font-semibold" onClick={() => setLanguage('vi')} disabled={i18n.resolvedLanguage === 'vi'} aria-pressed={i18n.resolvedLanguage === 'vi'}>VI</button>
        <span aria-hidden>/</span>
        <button type="button" className="hover:text-ink disabled:text-navy disabled:font-semibold" onClick={() => setLanguage('en')} disabled={i18n.resolvedLanguage === 'en'} aria-pressed={i18n.resolvedLanguage === 'en'}>EN</button>
      </div>
      <div className="relative" ref={ref}>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2.5 h-11 pl-1.5 pr-2.5 rounded-btn border border-line bg-white text-left">
          <span className="w-[30px] h-[30px] rounded-full bg-navy text-white inline-flex items-center justify-center text-[11px] font-bold">{initials(user?.name)}</span>
          <span><span className="block text-[12.5px] font-semibold leading-4">{user?.name}</span><span className="block text-[11px] text-muted leading-[14px]">{user?.role ? t(`role.${user.role}`) : ''}</span></span>
          <Icon name="chevDown" className="w-3.5 h-3.5" />
        </button>
        {open && (
          <ul role="listbox" className="absolute right-0 top-12 z-40 w-48 bg-white border border-line rounded-xl shadow-pop py-1.5">
            <li><button type="button" onClick={() => void handleLogout()} className="w-full text-left px-3 h-9 flex items-center gap-2 hover:bg-subtle text-bad"><Icon name="x" className="w-4 h-4" />{t('nav.logout')}</button></li>
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- chrome context: lets a page set its own crumbs/search without re-mounting the shell ---------- */
export type Crumb = string | [string, string];
interface Chrome {
  crumbs: Crumb[];
  search?: string;
  onSearch?: (v: string) => void;
  wide: boolean;
}
const DEFAULT_CHROME: Chrome = { crumbs: [], wide: true };
/** Shown for a route that hasn't been migrated to call usePageChrome() yet. */
function fallbackCrumb(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}
const ChromeContext = createContext<{ setChrome: (c: Partial<Chrome>) => void } | null>(null);

/** Call once per page to set the topbar breadcrumb / search box. */
export function usePageChrome(chrome: Partial<Chrome>) {
  const ctx = useContext(ChromeContext);
  // Re-run when the serialized chrome changes (pages pass plain data, not stable refs).
  const key = JSON.stringify(chrome);
  useEffect(() => {
    ctx?.setChrome(chrome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, key]);
}

/** Route-level shell: sidebar + topbar. Rendered once by Layout.tsx; pages
 * customize the topbar via usePageChrome() instead of re-wrapping.
 *
 * Chrome lives in a ref (not state) and is reset synchronously during render
 * whenever the path changes — before the new route's own usePageChrome
 * effect runs — so a page that never calls usePageChrome never shows the
 * previous page's stale breadcrumb/search box.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const chromeRef = useRef<Chrome>(DEFAULT_CHROME);
  const lastPathRef = useRef(location.pathname);
  if (lastPathRef.current !== location.pathname) {
    lastPathRef.current = location.pathname;
    chromeRef.current = DEFAULT_CHROME;
  }
  const chrome = chromeRef.current;
  const setChrome = useCallback((patch: Partial<Chrome>) => {
    chromeRef.current = { ...chromeRef.current, ...patch };
    forceRender();
  }, []);
  const ctxValue = useMemo(() => ({ setChrome }), [setChrome]);

  return (
    <ChromeContext.Provider value={ctxValue}>
      <div className="flex flex-wrap min-h-screen bg-page">
        <Sidebar />
        <div className="flex-[999_1_560px] min-w-0 flex flex-col">
          <header className="min-h-14 bg-white border-b border-line flex flex-wrap items-center gap-x-5 gap-y-3 px-8 py-2">
            <div className="flex items-center gap-2 text-muted">
              {(() => {
                const crumbs = chrome.crumbs.length > 0 ? chrome.crumbs : [fallbackCrumb(location.pathname)];
                return crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {i === crumbs.length - 1 ? <b className="text-ink font-semibold">{Array.isArray(c) ? c[0] : c}</b> : Array.isArray(c) ? <Link to={c[1]} className="no-underline text-muted">{c[0]}</Link> : <span>{c}</span>}
                  </span>
                ));
              })()}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {chrome.search !== undefined && (
                <label className="flex items-center gap-2 h-9 w-[300px] max-w-full rounded-btn border border-line px-3 text-muted">
                  <Icon name="search" />
                  <input type="search" placeholder={chrome.search} aria-label={chrome.search} onChange={(e) => chrome.onSearch?.(e.target.value)} className="flex-1 min-w-0 outline-none bg-transparent text-ink" />
                </label>
              )}
              <Notifications />
              <UserMenu />
            </div>
          </header>
          <main className={`flex flex-col gap-5 px-8 pt-7 pb-12 w-full ${chrome.wide ? 'max-w-[1400px]' : 'max-w-[1240px]'}`}>{children}</main>
        </div>
      </div>
    </ChromeContext.Provider>
  );
}
