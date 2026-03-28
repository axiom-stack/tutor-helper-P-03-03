import { useEffect } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_MAIN_LINKS,
  ADMIN_SECONDARY_LINKS,
  TEACHER_MAIN_LINKS,
  TEACHER_SECONDARY_LINKS,
} from './nav-links';
import './mobile-nav-drawer.css';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const { user } = useAuth();

  const mainLinks =
    user?.userRole === 'admin' ? ADMIN_MAIN_LINKS : TEACHER_MAIN_LINKS;
  const secondaryLinks =
    user?.userRole === 'admin'
      ? ADMIN_SECONDARY_LINKS
      : TEACHER_SECONDARY_LINKS;

  const isTeacher = user?.userRole === 'teacher';
  const isAdmin = user?.userRole === 'admin';

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="mobile-drawer mobile-drawer--open"
      role="dialog"
      aria-modal="true"
      aria-label="القائمة الرئيسية"
    >
      <div
        className="mobile-drawer__backdrop"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Enter' && onClose()}
        tabIndex={-1}
        aria-hidden
      />
      <aside className="mobile-drawer__panel">
        <div className="mobile-drawer__header">
          <span className="mobile-drawer__title">القائمة</span>
          <button
            type="button"
            className="mobile-drawer__close"
            onClick={onClose}
            aria-label="إغلاق القائمة"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <nav className="mobile-drawer__nav">
          <ul className="mobile-drawer__list">
            {mainLinks.map(({ to, label, icon: Icon }) => (
              <li key={to} className="mobile-drawer__item">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `mobile-drawer__link ${isActive ? 'mobile-drawer__link--active' : ''}`
                  }
                  end={to === '/'}
                  onClick={onClose}
                >
                  <Icon className="mobile-drawer__link-icon" aria-hidden />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mobile-drawer__divider-wrap">
            <hr className="mobile-drawer__divider" />
          </div>
          <ul className="mobile-drawer__list">
            {secondaryLinks.map(({ to, label, icon: Icon }) => (
              <li key={to} className="mobile-drawer__item">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `mobile-drawer__link ${isActive ? 'mobile-drawer__link--active' : ''}`
                  }
                  onClick={onClose}
                >
                  <Icon className="mobile-drawer__link-icon" aria-hidden />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
