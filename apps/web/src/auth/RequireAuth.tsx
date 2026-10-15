import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../lib/types';
import { useAuth } from './useAuth';

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="cap text-center">…</p>;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && (!user.role || !roles.includes(user.role))) {
    return <Navigate to="/horses" replace />;
  }
  return <>{children}</>;
}
