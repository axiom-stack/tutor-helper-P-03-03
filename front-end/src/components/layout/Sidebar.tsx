import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useStage } from '../../context/StageContext';
import { getAllowedStages, parseStages } from '../../constants/education';
import {
  ADMIN_MAIN_LINKS,
  ADMIN_SECONDARY_LINKS,
  TEACHER_MAIN_LINKS,
  TEACHER_SECONDARY_LINKS,
} from './nav-links';
import './sidebar.css';

export function Sidebar() {
  const { user } = useAuth();
  const { activeStage, setActiveStage } = useStage();

  const mainLinks =
    user?.userRole === 'admin' ? ADMIN_MAIN_LINKS : TEACHER_MAIN_LINKS;
  const secondaryLinks =
    user?.userRole === 'admin'
      ? ADMIN_SECONDARY_LINKS
      : TEACHER_SECONDARY_LINKS;

  const isTeacher = user?.userRole === 'teacher';

  const profileStages = parseStages(user?.profile?.educational_stage ?? '');
  const stages = profileStages.length > 0 ? profileStages : getAllowedStages();

  return (
    <aside className="sidebar" role="navigation" aria-label="القائمة الجانبية">
      <nav className="sidebar__nav">
        {isTeacher && (
          <div className="sidebar__stage">
            <span className="sidebar__stage-label">المرحلة الحالية</span>
            <div
              className="sidebar__stage-toggle"
              role="radiogroup"
              aria-label="اختيار المرحلة التعليمية"
            >
              {stages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  role="radio"
                  aria-checked={activeStage === stage}
                  className={
                    activeStage === stage
                      ? 'sidebar__stage-pill sidebar__stage-pill--active'
                      : 'sidebar__stage-pill'
                  }
                  onClick={() => setActiveStage(stage)}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        )}
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
