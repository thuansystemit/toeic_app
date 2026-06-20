import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { IdleTimeout } from './IdleTimeout';
import { roleHome } from '../lib/roleHome';
import type { UserRole } from '../types/user';

interface Props {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    // Guests land on the public browse page, not the login form.
    return <Navigate to="/welcome" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    // Wrong role for this area — send the user to their own home.
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return (
    <>
      <IdleTimeout />
      <Outlet />
    </>
  );
}
