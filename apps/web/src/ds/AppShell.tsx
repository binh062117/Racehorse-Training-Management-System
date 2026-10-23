import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import type { Notification, Paginated, Role } from '../lib/types';
import { HORSE_LOGO, Icon } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: 'dashboard' },
  { to: '/horses', label: 'Ngựa đua', icon: 'horse' },
  { to: '/plans', label: 'Giáo án huấn luyện', icon: 'plans' },
  { to: '/races', label: 'Giải đua', icon: 'flag', roles: ['MANAGER', 'TRAINER', 'OWNER'] },
];
const HEALTH_NAV: NavItem[] = [
  { to: '/health-records', label: 'Hồ sơ khám bệnh', icon: 'steth', roles: ['VET'] },
  { to: '/vaccinations', label: 'Tiêm phòng & tẩy giun', icon: 'syringe', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
  { to: '/incidents', label: 'Sự cố y tế', icon: 'alert', roles: ['MANAGER', 'TRAINER', 'VET', 'GROOM'] },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', label: 'Phân quyền tài khoản', icon: 'user', roles: ['MANAGER'] },
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

const navRow = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 h-8 px-2.5 rounded-btn no-underline text-[14px] transition-colors ${isActive ? 'bg-[#e3e6eb] text-ink font-medium' : 'text-[#3f444a] hover:bg-[#e9ecf0] hover:text-ink'}`;

function NavGroup({ title, items }: { title?: string; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {title && <div className="px-2.5 pt-5 pb-1.5 text-[12px] font-medium text-muted">{title}</div>}
      {items.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={navRow}>
          <Icon name={icon} className="w-4 h-4 text-muted" />{label}
        </NavLink>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
      <span className="w-8 h-8 rounded-full bg-white border border-line flex-none overflow-hidden flex items-center justify-center">
        <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain scale-[1.25]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-[18px] text-ink">Racehorse Club</span>
        <span className="block text-[12px] leading-4 text-muted">Huấn luyện &amp; quản lý</span>
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
function NavContent({ unread }: { unread: number }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? null;
  const visible = (item: NavItem) => !item.roles || (role !== null && item.roles.includes(role));

  const handleLogout = async () => {
    if (!window.confirm(t('nav.logoutConfirm'))) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2.5 pb-4"><Brand /></div>
      <nav aria-label="Điều hướng chính" className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {NAV.filter(visible).map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={navRow}>
              <Icon name={icon} className="w-4 h-4 text-muted" />{label}
            </NavLink>
          ))}
          <NavLink to="/notifications" className={navRow}>
            <Icon name="bell" className="w-4 h-4 text-muted" />
            <span className="flex-1">Thông báo</span>
            {unread > 0 && <span className="num min-w-[20px] h-5 px-1.5 rounded-full bg-bad text-white text-[11.5px] font-medium inline-flex items-center justify-center" aria-label={`${unread} chưa đọc`}>{unread}</span>}
          </NavLink>
        </div>
        <NavGroup title="Sức khỏe" items={HEALTH_NAV.filter(visible)} />
        <NavGroup title="Quản trị" items={ADMIN_NAV.filter(visible)} />
      </nav>
      <div className="mt-3 pt-3 border-t border-line flex items-center gap-2.5 px-1">
        <span className="w-8 h-8 rounded-full bg-navy text-white flex-none inline-flex items-center justify-center text-[12px] font-semibold">{initials(user?.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium leading-[18px] truncate">{user?.name}</span>
          <span className="block text-[12px] leading-4 text-muted truncate">{user?.role ? t(`role.${user.role}`) : ''}</span>
        </span>
        <button type="button" onClick={() => void i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
          className="h-8 px-2 rounded-btn text-[12px] font-medium text-muted hover:bg-[#e9ecf0] hover:text-ink" aria-label="Đổi ngôn ngữ">
          {i18n.language === 'vi' ? 'VI' : 'EN'}
        </button>
        <button type="button" onClick={() => void handleLogout()} aria-label={t('nav.logout')} title={t('nav.logout')}
          className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-[#e9ecf0] hover:text-ink">
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
        <aside className="hidden md:flex flex-none w-[244px] h-screen sticky top-0 border-r border-line px-3 pt-5 pb-3">
          <div className="w-full"><NavContent unread={unread} /></div>
        </aside>

        {/* Phone: the sidebar folds into a top bar and a full-screen sheet. */}
        <div className="md:hidden sticky top-0 z-30 h-[52px] bg-page/95 border-b border-line flex items-center gap-3 px-4">
          <Link to="/dashboard" aria-label="Racehorse Club" className="w-8 h-8 rounded-full bg-white border border-line overflow-hidden flex items-center justify-center flex-none">
            <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain scale-[1.25]" />
          </Link>
          <span className="flex-1 min-w-0 truncate text-[15px] font-semibold">{pageName || 'Racehorse Club'}</span>
          {unread > 0 && (
            <Link to="/notifications" className="relative w-10 h-10 inline-flex items-center justify-center rounded-btn text-ink" aria-label={`Thông báo, ${unread} chưa đọc`}>
              <Icon name="bell" className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-bad" />
            </Link>
          )}
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Mở menu" aria-expanded={menuOpen}
            className="w-10 h-10 inline-flex items-center justify-center rounded-btn text-ink hover:bg-cream">
            <Icon name="menu" className="w-5 h-5" />
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-page animate-sheet flex flex-col px-3 pt-4 pb-4" role="dialog" aria-modal="true" aria-label="Điều hướng">
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"
              className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-btn text-ink hover:bg-cream">
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
