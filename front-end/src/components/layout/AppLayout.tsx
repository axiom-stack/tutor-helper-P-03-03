import { Outlet } from 'react-router';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';
import './app-layout.css';

/**
 * Main app shell: top NavBar + right Sidebar + content area.
 * Use inside a route that wraps authenticated dashboard pages.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <NavBar />
      <Sidebar />
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
