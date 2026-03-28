import { useState } from 'react';
import { Outlet } from 'react-router';
import { AdminTopBar } from './AdminTopBar';
import { Sidebar } from './Sidebar';
import { MobileNavDrawer } from './MobileNavDrawer';
import './admin-layout.css';

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="admin-layout">
      <AdminTopBar
        menuOpen={drawerOpen}
        onMenuToggle={() => setDrawerOpen((value) => !value)}
      />

      <div className="admin-layout__workspace">
        <div className="admin-layout__sidebar">
          <Sidebar variant="admin" />
        </div>

        <main className="admin-layout__main">
          <Outlet />
        </main>
      </div>

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant="admin"
      />
    </div>
  );
}
