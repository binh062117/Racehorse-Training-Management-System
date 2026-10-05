import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import type { Paginated, Notification, User, Role } from '../lib/types';
import {
  DashboardIcon,
  HorseIcon,
  PlanIcon,
  RaceIcon,
  HealthIcon,
  BellIcon,
  UserIcon,
} from './Icons';

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);

  const role: Role | null = user?.role ?? null;

  const handleLogout = async () => {
    if (!window.confirm(t('nav.logoutConfirm'))) return;
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const notifRes = await api.get<Paginated<Notification>>('/notifications', {
          params: { limit: 20 },
        });
        if (mounted && notifRes.data?.data) {
          const unread = notifRes.data.data.filter((n) => !n.read).length;
          setUnreadCount(unread);
        }
      } catch {
        // silently ignore error if notifications fail to fetch
      }

      if (user?.role === 'MANAGER') {
        try {
          const userRes = await api.get<User[]>('/users');
          if (mounted && userRes.data) {
            const pending = userRes.data.filter((u) => u.status === 'PENDING').length;
            setPendingUsersCount(pending);
          }
        } catch {
          // silently ignore
        }
      }
    };

    fetchCounts();
    return () => {
      mounted = false;
    };
  }, [user?.role, location.pathname]);

  // Determine topbar page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard') || path === '/') return t('nav.dashboard');
    if (path.startsWith('/horses')) {
      if (role === 'OWNER') return 'Ngựa của tôi';
      return t('nav.horses');
    }
    if (path.startsWith('/plans')) {
      if (role === 'TRAINER') return 'Giáo án huấn luyện';
      return t('nav.plans');
    }
    if (path.startsWith('/health-records')) return 'Hồ sơ khám bệnh';
    if (path.startsWith('/admin/users')) return t('nav.users');
    return t('app.title');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="app">
      {/* Left Sidebar Rail */}
      <aside className="rail">
        <div className="rail-brand">
          <p className="eyebrow">Racehorse Club</p>
          <h1>Racehorse System</h1>
          <p className="sub">{t('app.title')}</p>
        </div>

        <nav className="rail-nav">
          <div className="rail-section">Menu</div>

          {/* All authenticated roles have Dashboard */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
          >
            <span className="ico"><DashboardIcon /></span>
            <span>{t('nav.dashboard')}</span>
          </NavLink>

          {/* Horses: MANAGER (master list), TRAINER (all club horses), VET (health map), GROOM (stables), OWNER (owned horses) */}
          <NavLink
            to="/horses"
            className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
          >
            <span className="ico"><HorseIcon /></span>
            <span>
              {role === 'OWNER'
                ? 'Ngựa của tôi'
                : role === 'VET'
                ? 'Sơ đồ đàn ngựa'
                : role === 'GROOM'
                ? 'Chuồng & Khẩu phần'
                : t('nav.horses')}
            </span>
          </NavLink>

          {/* Training Plans: backend GET /training-plans has no @Roles — any authenticated role can view */}
          <NavLink
            to="/plans"
            className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
          >
            <span className="ico"><PlanIcon /></span>
            <span>{role === 'TRAINER' ? 'Giáo án huấn luyện' : t('nav.plans')}</span>
          </NavLink>

          {/* Races: MANAGER, TRAINER (register race), OWNER (race history) */}
          {(role === 'MANAGER' || role === 'TRAINER' || role === 'OWNER') && (
            <div
              className="rail-item"
              style={{ opacity: 0.65, cursor: 'default' }}
              title="Phân hệ Giải đua"
            >
              <span className="ico"><RaceIcon /></span>
              <span>{t('nav.races')}</span>
              <span className="badge-tag">Sắp có</span>
            </div>
          )}


          {/* Vaccinations & Deworming: backend chặn mỗi OWNER (xem vaccinations.controller.ts) */}
          {(role === 'MANAGER' || role === 'TRAINER' || role === 'VET' || role === 'GROOM') && (
            <NavLink
              to="/vaccinations"
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
            >
              <span className="ico"><HealthIcon /></span>
              <span>Tiêm phòng & Tẩy giun</span>
            </NavLink>
          )}


          {/* Health & Incidents: MANAGER, VET (medical records), GROOM (barn incident report), TRAINER (fatigue alerts) */}
          {role === 'VET' && (
            <NavLink
              to="/health-records"
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
            >
              <span className="ico"><HealthIcon /></span>
              <span>Hồ sơ khám bệnh</span>
            </NavLink>
          )}
          {(role === 'MANAGER' || role === 'GROOM' || role === 'TRAINER') && (
            <div
              className="rail-item"
              style={{ opacity: 0.65, cursor: 'default' }}
              title="Phân hệ Y tế & Sự cố"
            >
              <span className="ico"><HealthIcon /></span>
              <span>
                {role === 'GROOM'
                  ? 'Báo cáo sự cố'
                  : t('nav.incidents')}
              </span>
              <span className="badge-tag">Sắp có</span>
            </div>
          )}

          {/* Notifications: All roles */}
          {unreadCount > 0 && (
            <div className="rail-item" style={{ opacity: 0.85 }}>
              <span className="ico"><BellIcon /></span>
              <span>{t('nav.notifications')}</span>
              <span className="count">{unreadCount}</span>
            </div>
          )}

          {/* User Management & RBAC: MANAGER only */}
          {role === 'MANAGER' && (
            <>
              <div className="rail-section" style={{ marginTop: 8 }}>
                Quản trị hệ thống
              </div>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              >
                <span className="ico"><UserIcon /></span>
                <span>Phân quyền (RBAC)</span>
                {pendingUsersCount > 0 && (
                  <span className="count">{pendingUsersCount}</span>
                )}
              </NavLink>
            </>
          )}
        </nav>

        <div className="rail-foot">
          <div>
            Đang đăng nhập: <strong>{user?.name}</strong>
          </div>
          <div style={{ color: 'rgba(243, 239, 230, 0.55)', marginTop: 2 }}>
            Vai trò: {role ? t(`role.${role}`) : 'Chưa phân vai trò'}
          </div>
        </div>
      </aside>

      {/* Right Main Area */}
      <div className="main">
        <header className="topbar">
          <h2>{getPageTitle()}</h2>

          <div className="topbar-right">
            <div className="lang">
              <button
                type="button"
                className="linklike"
                onClick={() => setLanguage('vi')}
                disabled={i18n.language === 'vi'}
              >
                VI
              </button>
              <span aria-hidden>/</span>
              <button
                type="button"
                className="linklike"
                onClick={() => setLanguage('en')}
                disabled={i18n.language === 'en'}
              >
                EN
              </button>
            </div>

            {user && (
              <div className="user-badge">
                <div className="user-avatar">{getInitials(user.name)}</div>
                <div>
                  <strong>{user.name}</strong>
                  {role && (
                    <span className="role-tag"> · {t(`role.${role}`)}</span>
                  )}
                </div>
              </div>
            )}

            <button type="button" className="btn btn-sm" onClick={handleLogout}>
              {t('nav.logout')}
            </button>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
