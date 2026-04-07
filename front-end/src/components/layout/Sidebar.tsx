import { NavLink, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_MAIN_LINKS,
  ADMIN_SECONDARY_LINKS,
  TEACHER_MAIN_LINKS,
  TEACHER_SECONDARY_LINKS,
} from './nav-links';
import './sidebar.css';

interface SidebarProps {
  variant?: 'teacher' | 'admin';
}

export function Sidebar({ variant = 'teacher' }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  const mainLinks =
    user?.userRole === 'admin' ? ADMIN_MAIN_LINKS : TEACHER_MAIN_LINKS;
  const secondaryLinks =
    user?.userRole === 'admin'
      ? ADMIN_SECONDARY_LINKS
      : TEACHER_SECONDARY_LINKS;
  const displayName = user?.display_name || user?.username || 'مستخدم';
  const isAdminSidebar = variant === 'admin';

  return (
    <aside
      className={`sidebar sidebar--${variant}`}
      role="navigation"
      aria-label={isAdminSidebar ? 'القائمة الإدارية' : 'القائمة الجانبية'}
    >
      {isAdminSidebar ? (
        <div className="sidebar__header">
          <span className="sidebar__eyebrow">مساحة الإدارة</span>
          <strong className="sidebar__title">مركز التحكم</strong>
          <p className="sidebar__desc">
            {displayName}، استخدم هذه المساحة لمتابعة المعلمين والمنهج
            والتقارير من مكان واحد.
          </p>
        </div>
      ) : null}

      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {mainLinks.map(({ to, label, icon: Icon, isActiveMatch }) => (
            <li key={to} className="sidebar__item">
              <NavLink
                to={to}
                className={({ isActive }) => {
                  const active = isActiveMatch
                    ? isActiveMatch({
                        pathname: location.pathname,
                        search: location.search,
                      })
                    : isActive;
                  return `sidebar__link ${active ? 'sidebar__link--active' : ''}`;
                }}
                end={to === '/'}
              >
                <Icon className="sidebar__link-icon" aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {secondaryLinks.length > 0 ? (
          <>
            <div className="sidebar__divider-wrap">
              <hr className="sidebar__divider" />
            </div>

            <ul className="sidebar__list">
              {secondaryLinks.map(({ to, label, icon: Icon, isActiveMatch }) => (
                <li key={to} className="sidebar__item">
                  <NavLink
                    to={to}
                    className={({ isActive }) => {
                      const active = isActiveMatch
                        ? isActiveMatch({
                            pathname: location.pathname,
                            search: location.search,
                          })
                        : isActive;
                      return `sidebar__link ${active ? 'sidebar__link--active' : ''}`;
                    }}
                  >
                    <Icon className="sidebar__link-icon" aria-hidden />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
    </aside>
  );
}
