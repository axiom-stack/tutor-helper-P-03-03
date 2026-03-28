import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { NavBar } from './NavBar';
import { AdminLayout } from './AdminLayout';
import './app-layout.css';

/**
 * Main app shell for authenticated pages.
 */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isAssignmentsRoute = location.pathname.startsWith('/assignments');
  const isTeacherAlias = location.pathname === '/teacher';

  if (user?.userRole === 'admin' && (isAssignmentsRoute || isTeacherAlias)) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.userRole === 'admin' && location.pathname === '/') {
    return <Navigate to="/admin" replace />;
  }

  if (user?.userRole === 'admin') {
    return <AdminLayout />;
  }

  return (
    <div className="app-layout">
      <NavBar />
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
