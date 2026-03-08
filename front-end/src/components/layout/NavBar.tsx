import { useAuth } from '../../context/AuthContext';
import { MdAutoStories, MdLogout } from 'react-icons/md';
import './nav-bar.css';

const APP_TITLE = 'المساعد الذكي للمعلم';

export function NavBar() {
  const { user, logout } = useAuth();

  const displayName = user?.username ?? 'مستخدم';
  const avatarLetter = (user?.username?.trim().charAt(0) || 'م').toUpperCase();

  return (
    <header className="nav-bar" role="banner">
      <div className="nav-bar__brand">
        <div className="nav-bar__logo" aria-hidden>
          <MdAutoStories className="nav-bar__logo-icon" />
        </div>
        <h1 className="nav-bar__title">{APP_TITLE}</h1>
      </div>

      <div className="nav-bar__user">
        <span className="nav-bar__greeting">مرحباً، {displayName}</span>
        <div className="nav-bar__user-actions">
          <div
            className="nav-bar__avatar"
            aria-hidden
            title={displayName}
          >
            {avatarLetter}
          </div>
          <button
            type="button"
            className="nav-bar__logout"
            onClick={() => logout()}
            aria-label="تسجيل الخروج"
          >
            <MdLogout className="nav-bar__logout-icon" />
          </button>
        </div>
      </div>
    </header>
  );
}
