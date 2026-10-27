import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import type { Notification, Paginated, Role } from '../lib/types';
import { HORSE_LOGO, Icon } from './ui';
import { setLanguage } from '../i18n';

interface NavItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', defaultLabel: 'Tổng quan', icon: 'dashboard' },
  { to: '/horses', labelKey: 'nav.horses', defaultLabel: 'Ngựa đua', icon: 'horse' },
  { to: '/plans', labelKey: 'nav.plansTrainer', defaultLabel: 'Giáo án huấn luyện', icon: 'plans' },
  { to: '/races', labelKey: 'nav.races', defaultLabel: 'Giải đua', icon: 'flag', roles: ['MANAGER', 'TRAINER', 'OWNER'] },
];
const HEALTH_NAV: NavItem[] = [
  { to: '/health-records', labelKey: 'nav.healthRecords', defaultLabel: 'Hồ sơ khám bệnh', icon: 'steth', roles: ['VET'] },
  { to: '/vaccinations', labelKey: 'nav.vaccinations', defaultLabel: 'Tiêm phòng & tẩy giun', icon: 'syringe', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
  { to: '/incidents', labelKey: 'nav.incidents', defaultLabel: 'Sự cố y tế', icon: 'alert', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', labelKey: 'nav.users', defaultLabel: 'Phân quyền tài khoản', icon: 'user', roles: ['MANAGER'] },
];

const POLL_MS = 20_000;

/** Unread notifications for the nav count; refreshed on a timer and on demand. */
function useUnreadCount(): number {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Notification>>('/notifications', { params: { unread: true, limit: 1 } });
      setCount(res.data.meta.total);
    } catch {
      // the count just stays stale until the next poll
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
  return count;
}

/** Text that only shows while the desktop rail is open (hover / keyboard focus). */
const RAIL_FADE = 'whitespace-nowrap transition-opacity duration-150 opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100';

const navRow = ({ isActive }: { isActive: boolean }) =>
  // Navy rail, the same ground as the login banner: the active row is a lighter navy
  // with a brand-blue marker, idle rows are soft white.
  `relative flex items-center gap-3 h-9 px-3 rounded-btn no-underline text-[14px] transition-colors [&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:scale-[1.18] ${isActive ? 'bg-navy-track text-white font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-[#5b9bd5] [&_svg]:text-[#8fb8e0]' : 'text-[#c3cbd6] hover:bg-white/[.06] hover:text-white'}`;

function NavGroup({ title, items, rail }: { title?: string; items: NavItem[]; rail: boolean }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {title && (
        <div className="relative px-3 pt-5 pb-1.5 text-[12px] font-medium text-[#93a3b8]">
          {/* Closed rail: a hairline marks the group instead of its name. */}
          {rail && <span aria-hidden className="absolute left-3 right-3 top-[26px] h-px bg-white/10 transition-opacity duration-150 group-hover/rail:opacity-0 group-focus-within/rail:opacity-0" />}
          <span className={rail ? RAIL_FADE : ''}>{title}</span>
        </div>
      )}
      {items.map(({ to, labelKey, defaultLabel, icon }) => {
        const label = t(labelKey, defaultLabel);
        return (
          <NavLink key={to} to={to} className={navRow} title={rail ? label : undefined}>
            <Icon name={icon} className="w-4 h-4 flex-none text-[#93a3b8]" /><span className={rail ? RAIL_FADE : ''}>{label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

function Brand({ rail }: { rail: boolean }) {
  const { t } = useTranslation();
  return (
    <Link to="/dashboard" className="flex items-center gap-3 no-underline">
      <span className="w-9 h-9 rounded-full bg-white flex-none overflow-hidden flex items-center justify-center">
        <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain scale-[1.3]" />
      </span>
      <span className={`min-w-0 ${rail ? RAIL_FADE : ''}`}>
        <span className="block text-[14px] font-semibold leading-[18px] text-white">Racehorse Club</span>
        <span className="block text-[12px] leading-4 text-[#b7c0cc]">{t('app.subtitle', 'Huấn luyện & quản lý')}</span>
      </span>
    </Link>
  );
}

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/** Navigation shared by the desktop sidebar and the phone sheet. */
function NavContent({ unread, rail = false }: { unread: number; rail?: boolean }) {
  const fade = rail ? RAIL_FADE : '';
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? null;
  const visible = (item: NavItem) => !item.roles || (role !== null && item.roles.includes(role));

  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');
  const toggleLang = () => {
    const next = isVi ? 'en' : 'vi';
    setLanguage(next);
  };

  const handleLogout = async () => {
    if (!window.confirm(t('nav.logoutConfirm', 'Bạn chắc chắn muốn đăng xuất?'))) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-0.5 pb-4"><Brand rail={rail} /></div>
      <nav aria-label="Điều hướng chính" className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-0.5">
          {NAV.filter(visible).map(({ to, labelKey, defaultLabel, icon }) => {
            const label = t(labelKey, defaultLabel);
            return (
              <NavLink key={to} to={to} className={navRow} title={rail ? label : undefined}>
                <Icon name={icon} className="w-4 h-4 flex-none text-[#93a3b8]" /><span className={fade}>{label}</span>
              </NavLink>
            );
          })}
          <NavLink to="/notifications" className={navRow} title={rail ? t('nav.notifications', 'Thông báo') : undefined}>
            <span className="relative flex-none">
              <Icon name="bell" className="w-4 h-4 text-[#93a3b8]" />
              {/* Closed rail: the count shrinks to a dot on the bell. */}
              {rail && unread > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-bad ring-2 ring-navy transition-opacity duration-150 group-hover/rail:opacity-0 group-focus-within/rail:opacity-0" />}
            </span>
            <span className={`flex-1 ${fade}`}>{t('nav.notifications', 'Thông báo')}</span>
            {unread > 0 && <span className={`num min-w-[20px] h-5 px-1.5 rounded-full bg-bad text-white text-[11.5px] font-medium inline-flex items-center justify-center ${fade}`} aria-label={`${unread} chưa đọc`}>{unread}</span>}
          </NavLink>
        </div>
        <NavGroup title={t('nav.healthSection', 'Sức khỏe')} items={HEALTH_NAV.filter(visible)} rail={rail} />
        <NavGroup title={t('nav.adminSection', 'Quản trị')} items={ADMIN_NAV.filter(visible)} rail={rail} />
      </nav>
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2.5 px-1">
        <span className="w-8 h-8 rounded-full bg-[#1a4b8a] text-white flex-none inline-flex items-center justify-center text-[12px] font-semibold">{initials(user?.name)}</span>
        <span className={`min-w-0 flex-1 ${fade}`}>
          <span className="block text-[13.5px] font-medium leading-[18px] truncate text-white">{user?.name}</span>
          <span className="block text-[12px] leading-4 text-[#b7c0cc] truncate">{user?.role ? t(`role.${user.role}`) : ''}</span>
        </span>
        <button
          type="button"
          onClick={toggleLang}
          className={`h-8 px-2 rounded-btn text-[12px] font-medium border border-white/15 text-[#b7c0cc] hover:bg-white/[.08] hover:text-white transition-colors inline-flex items-center gap-1 ${fade}`}
          aria-label={isVi ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
          title={isVi ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
        >
          <span className={isVi ? 'text-white font-bold' : 'opacity-60'}>VI</span>
          <span className="opacity-30">/</span>
          <span className={!isVi ? 'text-white font-bold' : 'opacity-60'}>EN</span>
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label={t('nav.logout', 'Đăng xuất')}
          title={t('nav.logout', 'Đăng xuất')}
          className={`w-8 h-8 flex-none rounded-btn inline-flex items-center justify-center text-[#b7c0cc] hover:bg-white/[.08] hover:text-white ${fade}`}
        >
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );
}

/* ---------- chrome context: lets a page name itself for the phone bar and the browser tab ---------- */
export type Crumb = string | [string, string];
interface Chrome {
  crumbs: Crumb[];
  wide: boolean;
}
const DEFAULT_CHROME: Chrome = { crumbs: [], wide: true };
const ChromeContext = createContext<{ setChrome: (c: Partial<Chrome>) => void } | null>(null);

/** Call once per page to name it (phone top bar + document title). */
export function usePageChrome(chrome: Partial<Chrome>) {
  const ctx = useContext(ChromeContext);
  // Re-run when the serialized chrome changes (pages pass plain data, not stable refs).
  const key = JSON.stringify(chrome);
  useEffect(() => {
    ctx?.setChrome(chrome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, key]);
}

/** Route-level shell: sidebar + canvas. Rendered once by Layout.tsx.
 *
 * Chrome and the phone menu are stored together with the path they belong to,
 * so on navigation they read as reset straight away — a page never shows the
 * previous page's name, and the menu sheet closes — without effects or refs.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [chromeState, setChromeState] = useState<{ path: string; chrome: Chrome }>({ path: pathname, chrome: DEFAULT_CHROME });
  const chrome = chromeState.path === pathname ? chromeState.chrome : DEFAULT_CHROME;
  const setChrome = useCallback((patch: Partial<Chrome>) => {
    setChromeState((prev) => ({ path: pathname, chrome: { ...(prev.path === pathname ? prev.chrome : DEFAULT_CHROME), ...patch } }));
  }, [pathname]);
  const ctxValue = useMemo(() => ({ setChrome }), [setChrome]);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null);
  const unread = useUnreadCount();

  const last = chrome.crumbs[chrome.crumbs.length - 1];
  const pageName = last ? (Array.isArray(last) ? last[0] : last) : '';
  useEffect(() => {
    document.title = pageName ? `${pageName} · Racehorse Club` : 'Racehorse Club';
  }, [pageName]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuPath(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <ChromeContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-page md:flex">
        {/* Desktop sidebar: on the page ground, one hairline from the canvas. */}
        {/* Desktop: a 64px icon rail that opens over the page on hover or keyboard focus
            (a short delay on open so passing the mouse across it doesn't flash it open).
            The placeholder keeps the page beside the closed rail; the open panel overlays it. */}
        <div className="hidden md:block flex-none w-16" aria-hidden />
        <aside className="group/rail hidden md:flex fixed left-0 top-0 z-40 h-screen w-16 overflow-hidden bg-navy px-3 pt-5 pb-3
          transition-[width,box-shadow] duration-200 ease-out delay-0
          hover:w-[244px] hover:delay-[120ms] hover:shadow-[8px_0_32px_rgba(10,20,32,.28)]
          focus-within:w-[244px] focus-within:shadow-[8px_0_32px_rgba(10,20,32,.28)]">
          <div className="w-[220px] flex-none"><NavContent unread={unread} rail /></div>
        </aside>

        {/* Phone: the sidebar folds into a top bar and a full-screen sheet. */}
        <div className="md:hidden sticky top-0 z-30 h-[52px] bg-navy text-white flex items-center gap-3 px-4">
          <Link to="/dashboard" aria-label="Racehorse Club" className="w-8 h-8 rounded-full bg-white overflow-hidden flex items-center justify-center flex-none">
            <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain scale-[1.25]" />
          </Link>
          <span className="flex-1 min-w-0 truncate text-[15px] font-semibold">{pageName || 'Racehorse Club'}</span>
          {unread > 0 && (
            <Link to="/notifications" className="relative w-10 h-10 inline-flex items-center justify-center rounded-btn text-white" aria-label={`Thông báo, ${unread} chưa đọc`}>
              <Icon name="bell" className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-bad" />
            </Link>
          )}
          <button type="button" onClick={() => setMenuOpen(true)} aria-label={t('nav.menu', 'Menu')} aria-expanded={menuOpen}
            className="w-10 h-10 inline-flex items-center justify-center rounded-btn text-white hover:bg-white/[.08]">
            <Icon name="menu" className="w-5 h-5" />
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-navy animate-sheet flex flex-col px-3 pt-4 pb-4" role="dialog" aria-modal="true" aria-label={t('nav.menu', 'Điều hướng')}>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={t('common.cancel', 'Đóng menu')}
              className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-btn text-white hover:bg-white/[.08]">
              <Icon name="x" className="w-5 h-5" />
            </button>
            <NavContent unread={unread} />
          </div>
        )}

        <main className={`flex-1 min-w-0 flex flex-col gap-5 px-4 sm:px-6 lg:px-8 pt-5 md:pt-8 pb-14 w-full mx-auto ${chrome.wide ? 'max-w-[1320px]' : 'max-w-[1120px]'}`}>
          {children}
        </main>
      </div>
    </ChromeContext.Provider>
  );
}
