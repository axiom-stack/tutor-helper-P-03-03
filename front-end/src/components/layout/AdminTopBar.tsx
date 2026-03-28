import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MdLogout, MdMenu } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../offline/useOffline';
import './admin-top-bar.css';

interface AdminTopBarProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
}

export function AdminTopBar({ menuOpen, onMenuToggle }: AdminTopBarProps) {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing } = useOffline();
  const navigate = useNavigate();
  const [logoutPending, setLogoutPending] = useState(false);

  const displayName = user?.display_name || user?.username || 'المدير';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMenuToggle();
      }
    };

    if (!menuOpen) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, onMenuToggle]);

  const handleLogout = async () => {
    if (logoutPending) {
      return;
    }

    setLogoutPending(true);
    try {
      await logout();
    } finally {
      setLogoutPending(false);
      navigate('/authentication', { replace: true });
    }
  };

  return (
    <header className="admin-topbar" role="banner">
      <button
        type="button"
        className="admin-topbar__menu-btn"
        onClick={onMenuToggle}
        aria-label={menuOpen ? 'إغلاق قائمة الإدارة' : 'فتح قائمة الإدارة'}
        aria-expanded={menuOpen}
        aria-controls="admin-navigation-drawer"
      >
        <MdMenu className="admin-topbar__menu-icon" aria-hidden />
      </button>

      <Link to="/admin" className="admin-topbar__brand">
        <span className="admin-topbar__eyebrow">لوحة الإدارة</span>
        <strong>مساعد المعلم الذكي</strong>
        <small>الإشراف على المعلمين والمنهج والتقارير</small>
      </Link>

      <div className="admin-topbar__status-wrap" aria-label="حالة النظام">
        <span
          className={
            isOnline
              ? 'admin-topbar__status admin-topbar__status--online'
              : 'admin-topbar__status admin-topbar__status--offline'
          }
        >
          {isOnline ? 'متصل' : 'غير متصل'}
        </span>
        {isSyncing ? (
          <span className="admin-topbar__syncing">جارٍ المزامنة...</span>
        ) : null}
      </div>

      <button
        type="button"
        className="admin-topbar__profile"
        onClick={() => navigate('/settings')}
      >
        <span className="admin-topbar__profile-label">مرحباً</span>
        <strong className="admin-topbar__profile-name">{displayName}</strong>
      </button>

      <button
        type="button"
        className="admin-topbar__logout"
        onClick={() => void handleLogout()}
        disabled={logoutPending}
      >
        <span>{logoutPending ? '...' : 'خروج'}</span>
        <MdLogout className="admin-topbar__logout-icon" aria-hidden />
      </button>
    </header>
  );
}
