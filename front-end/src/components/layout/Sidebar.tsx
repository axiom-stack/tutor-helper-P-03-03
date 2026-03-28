import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_MAIN_LINKS,
  ADMIN_SECONDARY_LINKS,
  TEACHER_MAIN_LINKS,
  TEACHER_SECONDARY_LINKS,
} from './nav-links';
import './sidebar.css';

export function Sidebar() {
  const { user } = useAuth();

  const mainLinks =
    user?.userRole === 'admin' ? ADMIN_MAIN_LINKS : TEACHER_MAIN_LINKS;
  const secondaryLinks =
    user?.userRole === 'admin'
      ? ADMIN_SECONDARY_LINKS
      : TEACHER_SECONDARY_LINKS;

  return (
    <aside className="sidebar" role="navigation" aria-label="القائمة الجانبية">
      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {mainLinks.map(({ to, label, icon: Icon }) => (
            <li key={to} className="sidebar__item">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                end={to === '/'}
              >
                <Icon className="sidebar__link-icon" aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar__divider-wrap">
          <hr className="sidebar__divider" />
        </div>

        <ul className="sidebar__list">
          {secondaryLinks.map(({ to, label, icon: Icon }) => (
            <li key={to} className="sidebar__item">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
              >
                <Icon className="sidebar__link-icon" aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
