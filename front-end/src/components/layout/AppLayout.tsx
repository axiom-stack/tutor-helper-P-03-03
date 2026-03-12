import { useState } from 'react';
import { Outlet } from 'react-router';
import { MobileNavDrawer } from './MobileNavDrawer';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';
import './app-layout.css';

/**
 * Main app shell: top NavBar + right Sidebar (desktop) / hamburger + drawer (mobile).
 * Use inside a route that wraps authenticated dashboard pages.
 */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-layout">
      <NavBar onMenuClick={() => setMenuOpen(true)} />
      <Sidebar />
      <main className="app-layout__main">
        <Outlet />
      </main>
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
