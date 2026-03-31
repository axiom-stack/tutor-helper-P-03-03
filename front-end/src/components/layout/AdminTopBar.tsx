import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { MdLogout, MdMenu } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../offline/useOffline';
import { ADMIN_MAIN_LINKS, ADMIN_SECONDARY_LINKS } from './nav-links';
import './admin-top-bar.css';

interface AdminTopBarProps {
  menuOpen: boolean;
  onMenuOpenChange: (nextOpen: boolean) => void;
}

export function AdminTopBar({
  menuOpen,
  onMenuOpenChange,
}: AdminTopBarProps) {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  const displayName = user?.display_name || user?.username || 'المدير';
  const showMenuButton = location.pathname !== '/admin';
  const menuItems = useMemo(
    () => [...ADMIN_MAIN_LINKS, ...ADMIN_SECONDARY_LINKS],
    []
  );

  useEffect(() => {
    if (!showMenuButton && menuOpen) {
      onMenuOpenChange(false);
    }
  }, [menuOpen, onMenuOpenChange, showMenuButton]);

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
      const isRtl =
        window.getComputedStyle(document.documentElement).direction === 'rtl';

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

    const handlePointerDown = (
      event: MouseEvent | TouchEvent | PointerEvent
    ) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        !menuRef.current?.contains(target) &&
        !menuPanelRef.current?.contains(target)
      ) {
        onMenuOpenChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMenuOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, onMenuOpenChange]);

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
    <header className="admin-topbar" role="banner" ref={menuRef}>
      {showMenuButton ? (
        <button
          ref={menuButtonRef}
          type="button"
          className="admin-topbar__menu-btn"
          onClick={(event) => {
            event.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
          aria-label={menuOpen ? 'إغلاق قائمة الإدارة' : 'فتح قائمة الإدارة'}
          aria-expanded={menuOpen}
          aria-controls="admin-navigation-menu"
        >
          <MdMenu className="admin-topbar__menu-icon" aria-hidden />
        </button>
      ) : null}

      <div
        className={`admin-topbar__content ${
          showMenuButton ? '' : 'admin-topbar__content--home'
        }`}
      >
        <Link to="/admin" className="admin-topbar__brand">
          <span className="admin-topbar__eyebrow">لوحة الإدارة</span>
          <strong>مساعد المعلم الذكي</strong>
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
          className="admin-topbar__greeting"
          onClick={() => navigate('/settings')}
        >
          مرحبا <span className="admin-topbar__greeting-name">{displayName}</span>
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
      </div>

      {showMenuButton && menuOpen && menuPosition
        ? createPortal(
            <div
              ref={menuPanelRef}
              id="admin-navigation-menu"
              className="admin-topbar__menu-panel admin-topbar__menu-panel--portal"
              role="menu"
              aria-label="القائمة الرئيسية"
              style={menuPosition}
            >
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  className="admin-topbar__menu-item"
                  onClick={() => onMenuOpenChange(false)}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
