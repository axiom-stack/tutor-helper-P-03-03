import { createContext } from 'react';

export interface OfflineContextValue {
  isOnline: boolean;
  queueCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  refreshQueueCount: () => Promise<void>;
  processQueueNow: () => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextValue | undefined>(
  undefined
);

