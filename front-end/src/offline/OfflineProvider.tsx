import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OfflineContext, type OfflineContextValue } from './OfflineContext';
import { getPendingQueueCount } from './queue';
import { getIsOnline } from './network';
import { processOfflineQueue } from './queueProcessor';
import { warmOfflineExamTemplate } from './templateWarmup';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(getIsOnline());
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const refreshQueueCount = useCallback(async () => {
    setQueueCount(await getPendingQueueCount());
  }, []);

  const processQueueNow = useCallback(async () => {
    if (!getIsOnline()) {
      await refreshQueueCount();
      return;
    }

    setIsSyncing(true);
    try {
      await processOfflineQueue();
      setLastSyncAt(new Date().toISOString());
    } finally {
      setIsSyncing(false);
      await refreshQueueCount();
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    void refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void warmOfflineExamTemplate();
      void processQueueNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      void refreshQueueCount();
    };
    const handleQueueChanged = () => {
      void refreshQueueCount();
    };
    const handleSyncComplete = () => {
      setLastSyncAt(new Date().toISOString());
      void refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChanged);
    window.addEventListener('offline-sync-complete', handleSyncComplete);

    if (getIsOnline()) {
      void warmOfflineExamTemplate();
      void processQueueNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChanged);
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, [processQueueNow, refreshQueueCount]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      queueCount,
      isSyncing,
      lastSyncAt,
      refreshQueueCount,
      processQueueNow,
    }),
    [isOnline, isSyncing, lastSyncAt, processQueueNow, queueCount, refreshQueueCount]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
