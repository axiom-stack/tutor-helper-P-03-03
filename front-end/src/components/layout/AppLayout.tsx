import { Outlet } from 'react-router';
import { NavBar } from './NavBar';
import './app-layout.css';

/**
 * Main app shell for authenticated pages.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <NavBar />
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
