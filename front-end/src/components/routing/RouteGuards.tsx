import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

interface GuardProps {
  children: ReactNode;
}

function RouteLoadingScreen() {
  return (
    <div className="ui-loading-screen" aria-busy="true" aria-live="polite">
      <div className="ui-loading-shell">
        <span className="ui-spinner" aria-hidden />
      </div>
    </div>
  );
}

export function RequireAuth({ children }: GuardProps) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <RouteLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication" replace />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: GuardProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <RouteLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication" replace />;
  }

  if (user?.userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequireTeacher({ children }: GuardProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <RouteLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication" replace />;
  }

  if (user?.userRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user?.userRole !== 'teacher') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
