import { useState } from 'react';
import { Outlet } from 'react-router';
import { AdminTopBar } from './AdminTopBar';
import './admin-layout.css';

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="admin-layout">
      <AdminTopBar
        menuOpen={drawerOpen}
        onMenuOpenChange={setDrawerOpen}
      />

      <div className="admin-layout__workspace">
        <main className="admin-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
