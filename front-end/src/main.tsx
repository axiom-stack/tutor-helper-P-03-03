import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { OfflineProvider } from './offline/OfflineProvider.tsx';
import { registerOfflineServiceWorker } from './offline/serviceWorker.ts';

registerOfflineServiceWorker();

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <OfflineProvider>
      <App />
      <Toaster position="top-center" />
    </OfflineProvider>
  </AuthProvider>
);
