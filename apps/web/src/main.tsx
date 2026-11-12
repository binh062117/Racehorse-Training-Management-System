import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import './tailwind.css';
import './i18n';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HorsesPage } from './pages/HorsesPage';
import { StableMapPage } from './pages/StableMapPage';
import { HorseDetailPage } from './pages/HorseDetailPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { DashboardPage } from './pages/DashboardPage';
import { TrainingPlansPage } from './pages/TrainingPlansPage';
import { TrainingOverviewPage } from './pages/TrainingOverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { HealthSchedulePage } from './pages/HealthSchedulePage';
import { HealthRecordsPage } from './pages/HealthRecordsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { FinanceReportPage } from './pages/FinanceReportPage';
import { RacesPage } from './pages/RacesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SuppliesPage } from './pages/SuppliesPage';
import { HomeGate, LandingPage } from './pages/LandingPage';
import {
  HorseFormPage,
  HorseOwnershipPage,
  HorseRaceHistoryPage,
  MyHorsesPage,
} from './pages/HorseFlowPages';
import { AuditLogPage } from './pages/AuditLogPage';
import { AuditLogDetailPage } from './pages/AuditLogDetailPage';
import { DailyCarePage } from './pages/DailyCarePage';

const router = createBrowserRouter([
  // Visitors see what the club is before signing in; members go straight to the dashboard.
  { path: '/', element: <HomeGate /> },
  { path: '/about', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      {
        path: '/races',
        element: (
          <RequireAuth roles={['MANAGER', 'TRAINER', 'OWNER']}>
            <RacesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/vaccinations',
        element: (
          <RequireAuth roles={['MANAGER', 'TRAINER', 'VET', 'GROOM']}>
            <HealthSchedulePage />
          </RequireAuth>
        ),
      },
      { path: '/reports/finances', element: <RequireAuth roles={['MANAGER', 'OWNER']}><FinanceReportPage /></RequireAuth> },
      { path: '/horses', element: <HorsesPage /> },
      { path: '/stalls', element: <StableMapPage /> },
      {
        path: '/health-records',
        element: (
          <RequireAuth roles={['VET']}>
            <HealthRecordsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/daily-care',
        element: (
          <RequireAuth roles={['MANAGER', 'GROOM', 'TRAINER', 'VET', 'OWNER']}>
            <DailyCarePage />
          </RequireAuth>
        ),
      },
      {
        path: '/incidents',
        element: (
          <RequireAuth roles={['MANAGER', 'TRAINER', 'VET', 'GROOM']}>
            <IncidentsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/my-horses',
        element: (
          <RequireAuth roles={['OWNER']}>
            <MyHorsesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/horses/new',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <HorseFormPage />
          </RequireAuth>
        ),
      },
      {
        path: '/horses/:id/edit',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <HorseFormPage />
          </RequireAuth>
        ),
      },
      { path: '/horses/:id', element: <HorseDetailPage /> },
      { path: '/horses/:id/performance', element: <HorseRaceHistoryPage /> },
      { path: '/horses/:id/ownership', element: <HorseOwnershipPage /> },
      { path: '/plans', element: <TrainingPlansPage /> },
      { path: '/training/progress', element: <RequireAuth roles={['MANAGER', 'TRAINER']}><TrainingOverviewPage /></RequireAuth> },
      { path: '/reports', element: <RequireAuth roles={['OWNER', 'MANAGER']}><ReportsPage /></RequireAuth> },
      {
        path: '/supplies',
        element: (
          <RequireAuth roles={['MANAGER', 'GROOM', 'VET', 'TRAINER']}>
            <SuppliesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <AdminUsersPage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin/audit-logs',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <AuditLogPage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin/audit-logs/:id',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <AuditLogDetailPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
