import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);

  const displayName = user?.display_name || user?.username || 'مستخدم';
  const showMenuButton = true;
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

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const button = menuButtonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const menuOffset = 10;
      const top = Math.min(rect.bottom + menuOffset, window.innerHeight - 16);
      const isRtl = document.documentElement.dir === 'rtl';

      setMenuPosition(
        isRtl
          ? {
              top,
              right: Math.max(16, window.innerWidth - rect.right),
            }
          : {
              top,
              left: Math.max(16, rect.left),
            }
      );
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        !menuRef.current?.contains(target) &&
        !menuPanelRef.current?.contains(target)
      ) {
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
          ref={menuButtonRef}
          type="button"
          className="nav-bar__menu-btn"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={menuOpen}
          aria-controls="header-nav-menu"
        >
          <MdMenu className="nav-bar__menu-icon" aria-hidden />
        </button>
      ) : null}

      {showMenuButton && menuOpen && menuPosition
        ? createPortal(
            <div
              ref={menuPanelRef}
              id="header-nav-menu"
              className="nav-bar__menu-panel nav-bar__menu-panel--portal"
              role="menu"
              aria-label="القائمة الرئيسية"
              style={menuPosition}
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
            </div>,
            document.body
          )
        : null}

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
