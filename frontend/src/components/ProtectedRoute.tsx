import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { IdleTimeout } from './IdleTimeout';
import type { UserRole } from '../types/user';

interface Props {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return (
    <>
      <IdleTimeout />
      <Outlet />
    </>
  );
}
