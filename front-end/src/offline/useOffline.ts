import { useContext } from 'react';
import { OfflineContext } from './OfflineContext';

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}

