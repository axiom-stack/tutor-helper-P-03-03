import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export type StageId = 'ابتدائي' | 'اعدادي' | 'ثانوي';

const ALLOWED_STAGES: StageId[] = ['ابتدائي', 'اعدادي', 'ثانوي'];
const STORAGE_KEY = 'tutor-helper-active-stage';

interface StageContextValue {
  activeStage: StageId;
  setActiveStage: (stage: StageId) => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

function normalizeStage(value: unknown): StageId | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // Exact match first
  if (ALLOWED_STAGES.includes(raw as StageId)) {
    return raw as StageId;
  }

  // Support profiles that store multiple stages in a single string
  // e.g. "ابتدائي، اعدادي" or "ابتدائي,اعدادي"
  for (const stage of ALLOWED_STAGES) {
    if (raw.includes(stage)) {
      return stage;
    }
  }

  return null;
}

function getInitialStage(preferredFromProfile: string | null | undefined): StageId {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const fromStorage = normalizeStage(stored);
    if (fromStorage) {
      return fromStorage;
    }
  }

  const fromProfile = normalizeStage(preferredFromProfile ?? undefined);
  if (fromProfile) {
    return fromProfile;
  }

  // Sensible default if nothing else is available.
  return 'ابتدائي';
}

export function StageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const preferredStage = user?.profile?.educational_stage ?? null;
  const [activeStage, setActiveStageState] = useState<StageId>(() =>
    getInitialStage(preferredStage)
  );

  useEffect(() => {
    // When profile changes (e.g., login), only update stage if there is no stored preference.
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return;
    }
    const fromProfile = normalizeStage(preferredStage ?? undefined);
    if (fromProfile && fromProfile !== activeStage) {
      setActiveStageState(fromProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredStage]);

  const setActiveStage = (next: StageId) => {
    setActiveStageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
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

export function getAllowedStages(): StageId[] {
  return [...ALLOWED_STAGES];
}

