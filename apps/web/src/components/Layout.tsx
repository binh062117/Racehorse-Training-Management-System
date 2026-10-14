import { Outlet } from 'react-router-dom';
import { AppShell } from '../ds/AppShell';

/**
 * Route-level shell — every authenticated page renders inside this. Visual
 * design: Racehorse DS v3 (navy/cream, Barlow Condensed headlines), ported
 * from the racehorse-ui mockup (see apps/web/src/ds/).
 *
 * The sidebar/topbar live in AppShell and never remount between page
 * navigations; each page customizes its own breadcrumb/search box via
 * usePageChrome() instead of this file knowing about every route.
 */
export function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
