import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { Page } from '../ds/AppShell';

/**
 * Route-level shell — every authenticated page renders inside this. Visual
 * design: Racehorse DS v3 (navy/cream, Barlow Condensed headlines), ported
 * from the racehorse-ui mockup (see apps/web/src/ds/).
 *
 * Breadcrumb is a single generic label derived from the path for now; pages
 * migrated to the new design pass their own richer crumbs by rendering
 * <Page> themselves instead of relying on this wrapper (see HorsesPage etc.)
 */
export function Layout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role ?? null;

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard') || path === '/') return t('nav.dashboard');
    if (path.startsWith('/horses')) {
      if (role === 'OWNER') return t('nav.horsesOwner');
      return t('nav.horses');
    }
    if (path.startsWith('/plans')) {
      if (role === 'TRAINER') return t('nav.plansTrainer');
      return t('nav.plans');
    }
    if (path.startsWith('/races')) return t('nav.races');
    if (path.startsWith('/vaccinations')) return t('nav.vaccinations');
    if (path.startsWith('/notifications')) return t('nav.notifications');
    if (path.startsWith('/health-records')) return t('nav.healthRecords');
    if (path.startsWith('/incidents')) return t('nav.incidents');
    if (path.startsWith('/admin/users')) return t('nav.users');
    return t('app.title');
  };

  return (
    <Page crumbs={[getPageTitle()]}>
      <Outlet />
    </Page>
  );
}
