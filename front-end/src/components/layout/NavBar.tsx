import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { MdLogout, MdMenu } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../offline/useOffline';
import { getHeaderNavItems } from './nav-menu';
import './nav-bar.css';

export function NavBar() {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing } = useOffline();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.display_name || user?.username || 'مستخدم';
  const isHomePage =
    location.pathname === '/' || location.pathname === '/teacher';
  const showMenuButton = !isHomePage;
  const menuItems = useMemo(
    () => getHeaderNavItems(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (!showMenuButton) {
      setMenuOpen(false);
    }
  }, [showMenuButton]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const connectionLabel = isOnline ? 'متصل' : 'غير متصل';

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/authentication', { replace: true });
    }
  };

  return (
    <header className="nav-bar" role="banner" ref={menuRef}>
      {showMenuButton ? (
        <button
          type="button"
          className="nav-bar__menu-btn"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="فتح القائمة"
          aria-expanded={menuOpen}
          aria-controls="header-nav-menu"
        >
          <MdMenu className="nav-bar__menu-icon" aria-hidden />
        </button>
      ) : null}

      {showMenuButton && menuOpen ? (
        <div
          id="header-nav-menu"
          className="nav-bar__menu-panel"
          role="menu"
          aria-label="القائمة الرئيسية"
        >
          {menuItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              role="menuitem"
              className="nav-bar__menu-item"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div
        className={`nav-bar__content ${
          showMenuButton ? '' : 'nav-bar__content--home'
        }`}
      >
        <Link to="/" className="nav-bar__brand">
          المساعد الذكي للمعلم
        </Link>

        <div className="nav-bar__status-wrap" aria-label="حالة الاتصال">
          <span
            className={
              isOnline
                ? 'nav-bar__status nav-bar__status--online'
                : 'nav-bar__status nav-bar__status--offline'
            }
          >
            {connectionLabel}
          </span>

          {isSyncing ? (
            <span className="nav-bar__syncing">جارٍ المزامنة...</span>
          ) : null}
        </div>

        <button
          type="button"
          className="nav-bar__greeting"
          onClick={() => navigate('/settings')}
        >
          مرحبا <span className="nav-bar__greeting-name">{displayName}</span>
        </button>

        <button type="button" className="nav-bar__logout" onClick={() => void handleLogout()}>
          <span>خروج</span>
          <MdLogout className="nav-bar__logout-icon" aria-hidden />
        </button>
      </div>
    </header>
  );
}
