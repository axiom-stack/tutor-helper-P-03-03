import { useAuth } from '../../context/AuthContext';
import { MdAutoStories, MdLogout, MdMenu } from 'react-icons/md';
import { useOffline } from '../../offline/useOffline';
import './nav-bar.css';

const APP_TITLE = 'المساعد الذكي للمعلم';

interface NavBarProps {
  onMenuClick?: () => void;
}

export function NavBar({ onMenuClick }: NavBarProps) {
  const { user, logout } = useAuth();
  const { isOnline, queueCount, isSyncing, processQueueNow } = useOffline();

  const displayName = user?.username ?? 'مستخدم';
  const avatarLetter = (user?.username?.trim().charAt(0) || 'م').toUpperCase();

  return (
    <header className="nav-bar" role="banner">
      <div className="nav-bar__brand">
        {onMenuClick ? (
          <button
            type="button"
            className="nav-bar__menu-btn"
            onClick={onMenuClick}
            aria-label="فتح القائمة"
            aria-expanded="false"
          >
            <MdMenu className="nav-bar__menu-icon" aria-hidden />
          </button>
        ) : null}
        <div className="nav-bar__logo" aria-hidden>
          <MdAutoStories className="nav-bar__logo-icon" />
        </div>
        <h1 className="nav-bar__title">{APP_TITLE}</h1>
      </div>

      <div className="nav-bar__user">
        <div className="nav-bar__status-wrap">
          <span
            className={`nav-bar__status ${isOnline ? 'nav-bar__status--online' : 'nav-bar__status--offline'}`}
          >
            {isOnline ? 'متصل' : 'غير متصل'}
            {queueCount > 0 ? ` • ${queueCount} بانتظار المزامنة` : ''}
          </span>
          {isOnline && queueCount > 0 ? (
            <button
              type="button"
              className="nav-bar__sync-btn"
              onClick={() => void processQueueNow()}
              disabled={isSyncing}
            >
              {isSyncing ? 'جارٍ المزامنة...' : 'مزامنة الآن'}
            </button>
          ) : null}
        </div>
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
