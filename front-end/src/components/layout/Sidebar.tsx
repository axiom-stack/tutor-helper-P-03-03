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
import './sidebar.css';

const MAIN_LINKS = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/lessons', label: 'خطط الدروس', icon: MdMenuBook },
  { to: '/assignments', label: 'الواجبات', icon: MdAssignment },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
] as const;

const SECONDARY_LINKS = [
  { to: '/teachers', label: 'المعلمون', icon: MdGroup },
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar" role="navigation" aria-label="القائمة الجانبية">
      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {MAIN_LINKS.map(({ to, label, icon: Icon }) => (
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
          {SECONDARY_LINKS.map(({ to, label, icon: Icon }) => (
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

      <div className="sidebar__footer">
        <div className="sidebar__support">
          <p className="sidebar__support-text">
            تحتاج مساعدة؟ تواصل مع الدعم الفني
          </p>
        </div>
      </div>
    </aside>
  );
}
