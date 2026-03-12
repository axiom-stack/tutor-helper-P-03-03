import type { ComponentType } from 'react';
import { NavLink } from 'react-router';
import {
  MdHome,
  MdMenuBook,
  MdAssignment,
  MdQuiz,
  MdSchool,
  MdSettings,
  MdGroup,
  MdInsights,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import './sidebar.css';

type SidebarLink = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

const TEACHER_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/lessons', label: 'إنشاء الخطط', icon: MdMenuBook },
  { to: '/plans', label: 'الخطط المولدة', icon: MdMenuBook },
  { to: '/assignments', label: 'الواجبات', icon: MdAssignment },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];

const ADMIN_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/plans', label: 'الخطط المولدة', icon: MdMenuBook },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];

const TEACHER_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
];

const ADMIN_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/teachers', label: 'المعلمون', icon: MdGroup },
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
];

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
