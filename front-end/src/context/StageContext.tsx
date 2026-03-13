/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { type StageId, normalizeStage } from '../constants/education';

const BASE_STORAGE_KEY = 'tutor-helper-active-stage';

interface StageContextValue {
  activeStage: StageId;
  setActiveStage: (stage: StageId) => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const getStorageKey = (uid: number | undefined) => {
    return uid ? `${BASE_STORAGE_KEY}:${uid}` : BASE_STORAGE_KEY;
  };

  const getInitialStage = (uid: number | undefined, preferredFromProfile: string | null | undefined): StageId => {
    if (typeof window !== 'undefined') {
      const key = getStorageKey(uid);
      const stored = window.localStorage.getItem(key);
      const fromStorage = normalizeStage(stored);
      if (fromStorage) {
        return fromStorage;
      }
    }

    const fromProfile = normalizeStage(preferredFromProfile ?? undefined);
    if (fromProfile) {
      return fromProfile;
    }

    if (user?.userRole === 'admin') {
      return 'all';
    }

    // Sensible default if nothing else is available.
    return 'ابتدائي';
  };

  const preferredStage = user?.profile?.educational_stage ?? null;
  const [activeStage, setActiveStageState] = useState<StageId>(() =>
    getInitialStage(userId, preferredStage)
  );

  useEffect(() => {
    // When user or profile changes, re-evaluate stage preference.
    if (typeof window === 'undefined') return;
    const key = getStorageKey(userId);
    const stored = window.localStorage.getItem(key);
    
    if (stored) {
      const fromStorage = normalizeStage(stored);
      if (fromStorage && fromStorage !== activeStage) {
        setActiveStageState(fromStorage);
      }
      return;
    }

    const fromProfile = normalizeStage(preferredStage ?? undefined);
    if (fromProfile && fromProfile !== activeStage) {
      setActiveStageState(fromProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, preferredStage]);

  const setActiveStage = (next: StageId) => {
    if (next === activeStage) {
      return;
    }

    setActiveStageState(next);

    if (typeof window !== 'undefined') {
      const key = getStorageKey(userId);
      window.localStorage.setItem(key, next);
      // Reload the current page so that all views and filters
      // are reset to match the newly selected stage.
      window.location.reload();
    }
  };

  return (
    <StageContext.Provider value={{ activeStage, setActiveStage }}>
      {children}
    </StageContext.Provider>
  );
}

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) {
    throw new Error('useStage must be used within a StageProvider');
  }
  return ctx;
}

