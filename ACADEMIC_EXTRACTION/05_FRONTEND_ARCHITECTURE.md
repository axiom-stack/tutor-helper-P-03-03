# 5. FRONTEND ARCHITECTURE & IMPLEMENTATION

## 5.1 Frontend Stack & Tooling

**Framework:** React 19 (TypeScript)  
**Build Tool:** Vite (v7.3.1)  
**Router:** React Router (v7.13.1)  
**HTTP Client:** Axios (v1.13.6)  
**State Management:** React Context API (no Redux)  
**Offline DB:** IndexedDB (idb library v8.0.3)  
**UI Components:** Custom components + TailwindCSS (inferred)  
**Notifications:** React Hot Toast  
**Service Worker:** Custom offline-sw.js  
**Type Checking:** TypeScript (v5.9.3)

---

## 5.2 Frontend Module Structure

```
front-end/src/
│
├── main.tsx                        # React entry point
├── App.tsx                         # Root component + routing
├── App.css                         # Global styles
├── index.css                       # Base styles
│
├── components/                     # Reusable UI components
│   ├── common/
│   │   ├── Button.tsx              # Reusable button
│   │   ├── Modal.tsx               # Dialog/modal
│   │   ├── Loader.tsx              # Loading indicator
│   │   ├── ErrorBoundary.tsx       # Error handling
│   │   ├── Header.tsx              # Navigation header
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   └── FormField.tsx           # Input field wrapper
│   │
│   ├── auth/
│   │   ├── LoginForm.tsx           # Login UI
│   │   ├── ProtectedRoute.tsx      # Route guard component
│   │   └── LogoutButton.tsx        # Logout action
│   │
│   ├── lesson-components/
│   │   ├── LessonForm.tsx          # Create lesson inputs
│   │   ├── ObjectiveSection.tsx    # Learning objectives UI
│   │   ├── ActivitiesSection.tsx   # Learning activities UI
│   │   ├── AssessmentSection.tsx   # Assessment methods UI
│   │   └── TimeBreakdownUI.tsx     # 10-60-20-10 visualization
│   │
│   ├── plan-components/
│   │   ├── PlanViewer.tsx          # Display lesson plan
│   │   ├── PlanEditor.tsx          # Edit lesson plan
│   │   ├── RefinementPanel.tsx     # AI suggestions UI
│   │   ├── ExportOptions.tsx       # PDF/Word buttons
│   │   └── ReviewMetrics.tsx       # Quality score display
│   │
│   ├── assignment-components/
│   │   ├── AssignmentForm.tsx      # Create assignments
│   │   └── AssignmentPreview.tsx   # Display assignments
│   │
│   ├── exam-components/
│   │   ├── ExamCreator.tsx         # Exam creation UI
│   │   ├── BlueprintViewer.tsx     # Table of Specs display
│   │   ├── QuestionBank.tsx        # Generated questions UI
│   │   └── ExamPreview.tsx         # Print preview
│   │
│   └── dashboard-components/
│       ├── StatsCard.tsx           # Metric display card
│       ├── TrendChart.tsx          # Chart visualization
│       └── TeacherStatsPanel.tsx   # Teacher KPIs
│
├── features/                       # Feature-specific modules
│   ├── lessonCreator/
│   │   ├── LessonCreator.tsx       # Main lesson creation page
│   │   ├── useLessonForm.ts        # Form state + validation
│   │   ├── lessonRequests.ts       # API calls
│   │   └── lessonNormalizers.ts    # Response transformation
│   │
│   ├── planViewer/
│   │   ├── PlanViewerPage.tsx      # Plan viewing page
│   │   ├── usePlanData.ts          # Fetch plan + handle loading
│   │   ├── useRefinement.ts        # Refinement workflow
│   │   └── planExport.ts           # Export orchestration
│   │
│   ├── assignment/
│   │   ├── AssignmentCreator.tsx   # Assignment creation
│   │   ├── useAssignmentForm.ts    # Form state
│   │   └── assignmentRequests.ts   # API calls
│   │
│   ├── examCreator/
│   │   ├── ExamCreator.tsx         # Exam creation page
│   │   ├── useExamCreation.ts      # Form + blueprint logic
│   │   ├── examRequests.ts         # API calls
│   │   └── blueprintCalculator.ts  # Frontend blueprint calc
│   │
│   ├── dashboard/
│   │   ├── ControlDashboard.tsx    # Teacher dashboard
│   │   ├── AdminDashboard.tsx      # Admin dashboard
│   │   ├── useDashboardData.ts     # Stats API calls
│   │   └── dashboardRequests.ts    # Stats endpoints
│   │
│   └── settings/
│       ├── Settings.tsx            # Settings page
│       ├── useSettings.ts          # Settings state
│       └── settingsRequests.ts     # Update endpoints
│
├── hooks/                          # Custom React hooks
│   ├── useAuth.ts                  # Authentication context
│   ├── useApi.ts                   # Generic API calling
│   ├── usePagination.ts            # Pagination logic
│   ├── useForm.ts                  # Form state + validation
│   ├── useLocalStorage.ts          # Browser storage
│   ├── useIndexedDB.ts             # IndexedDB operations
│   ├── useNetworkStatus.ts         # Online/offline detection
│   ├── useDebounce.ts              # Debounce utility
│   ├── useAsyncEffect.ts           # Async side effects
│   ├── useToast.ts                 # Toast notifications
│   └── usePlanData.ts              # Load + sync plan data
│
├── context/                        # React Context providers
│   ├── AuthContext.tsx             # User auth state
│   ├── ApiContext.tsx              # HTTP client + interceptors
│   ├── OfflineContext.tsx          # Offline/sync state
│   └── NotificationContext.tsx     # Toast notifications
│
├── types/                          # TypeScript definitions
│   ├── index.ts                    # All type exports
│   ├── user.ts                     # User, UserRole, UserProfile
│   ├── curriculum.ts               # Class, Subject, Unit, Lesson
│   ├── lessonPlan.ts               # LessonPlan, Objective, Activity
│   ├── assignment.ts               # Assignment types
│   ├── exam.ts                     # Exam, Blueprint, Question
│   ├── refinement.ts               # RefinementRequest, Attempt
│   ├── stats.ts                    # Statistics, KPIs
│   ├── api.ts                      # API request/response types
│   ├── offline.ts                  # Sync, Queue, IndexedDB types
│   └── errors.ts                   # Custom error types
│
├── constants/
│   ├── bloomVerbs.ts               # Bloom taxonomy reference
│   ├── pedagogicalRules.ts         # Validation rules
│   ├── apiEndpoints.ts             # API URLs
│   ├── errorMessages.ts            # User-facing error text (AR/EN)
│   ├── formDefaults.ts             # Initial form values
│   └── appConfig.ts                # Feature flags, settings
│
├── utils/
│   ├── api.utils.ts                # Axios instance + interceptors
│   ├── validation.ts               # Form validators
│   ├── formatters.ts               # Date, time, number formatting
│   ├── planParsers.ts              # Parse plan JSON structure
│   ├── exportFormatters.ts         # Format for export (HTML, DOCX)
│   ├── bloomHelper.ts              # Bloom verb utilities
│   ├── timeHelper.ts               # Time calculations
│   ├── cryptoHelper.ts             # Encryption (if needed)
│   └── errorHandler.ts             # Error processing
│
├── offline/
│   ├── db.ts                       # IndexedDB schema + operations
│   ├── serviceWorker.ts            # Service worker logic
│   ├── sync.ts                     # Sync queue + reconciliation
│   ├── offline-sw.js               # Service worker file (public/)
│   └── syncManager.ts              # Coordinate sync operations
│
└── assets/
    ├── images/
    ├── icons/
    └── videos/
```

---

## 5.3 Core Components & Pages

### App.tsx (Routing Root)

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ApiProvider } from './context/ApiContext';
import { OfflineProvider } from './context/OfflineContext';
import { NotificationProvider } from './context/NotificationContext';

// Pages
import AuthenticationPage from './features/authentication/AuthenticationPage';
import ControlDashboard from './features/dashboard/ControlDashboard';
import AdminDashboard from './features/dashboard/AdminDashboard';
import LessonCreator from './features/lessonCreator/LessonCreator';
import PlanViewerPage from './features/planViewer/PlanViewerPage';
import AssignmentCreator from './features/assignment/AssignmentCreator';
import ExamCreator from './features/examCreator/ExamCreator';
import ControlCurriculum from './features/curriculum/ControlCurriculum';
import Settings from './features/settings/Settings';

// Guards
import RequireAuth from './components/auth/RequireAuth';
import RequireTeacher from './components/auth/RequireTeacher';
import RequireAdmin from './components/auth/RequireAdmin';

// Layout
import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <OfflineProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Route */}
                <Route path="/authentication" element={<AuthenticationPage />} />

                {/* Protected Routes */}
                <Route
                  element={
                    <RequireAuth>
                      <MainLayout>
                        <Outlet />
                      </MainLayout>
                    </RequireAuth>
                  }
                >
                  {/* Teacher Routes */}
                  <Route
                    path="/"
                    element={
                      <RequireTeacher>
                        <ControlDashboard />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/curriculum"
                    element={
                      <RequireTeacher>
                        <ControlCurriculum />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/lessons"
                    element={
                      <RequireTeacher>
                        <LessonCreator />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/plans/:planId"
                    element={
                      <RequireTeacher>
                        <PlanViewerPage />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/assignments"
                    element={
                      <RequireTeacher>
                        <AssignmentCreator />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/quizzes/create"
                    element={
                      <RequireTeacher>
                        <ExamCreator />
                      </RequireTeacher>
                    }
                  />
                  <Route
                    path="/settings"
                    element={<Settings />}
                  />

                  {/* Admin Routes */}
                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <AdminDashboard />
                      </RequireAdmin>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </OfflineProvider>
      </ApiProvider>
    </AuthProvider>
  );
}

export default App;
```

### useAuth Hook (Authentication State)

```typescript
import { createContext, useContext, useState, useCallback } from 'react';
import { User } from '../types';
import axiosInstance from '../utils/api.utils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage or refresh endpoint
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Verify + load user
        const response = await axiosInstance.get('/api/users/profile');
        setUser(response.data);
      }
    } catch (error) {
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await axiosInstance.post('/api/auth/login', {
      email,
      password
    });
    const { token, user } = response.data;

    localStorage.setItem('auth_token', token);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await axiosInstance.post('/api/auth/logout');
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem('auth_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
```

### useLessonCreator Hook (Lesson Creation Orchestration)

```typescript
import { useState, useCallback } from "react";
import { usePlanData } from "./usePlanData";
import axiosInstance from "../../utils/api.utils";
import { LessonPlanRequest } from "../../types";

export function useLessonCreator() {
  const [formData, setFormData] = useState<LessonPlanRequest>({
    lesson_title: "",
    lesson_content: "",
    subject: "",
    grade: "",
    duration_minutes: 45,
    plan_type: "traditional",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Validate form
      validateFormData(formData);

      // 2. Call backend
      const response = await axiosInstance.post("/api/generate-plan", formData);

      // 3. Store response
      setGeneratedPlan(response.data);

      // 4. If offline: queue for sync
      if (!navigator.onLine) {
        await queuePlanForSync(response.data);
      }

      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [formData]);

  const updateFormField = useCallback((field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return {
    formData,
    updateFormField,
    generatePlan,
    loading,
    error,
    generatedPlan,
  };
}
```

---

## 5.4 State Management (Context API)

### ApiContext (Centralized HTTP Client)

```typescript
import axios from 'axios';
import { useAuth } from './AuthContext';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3500/api';

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  const axiosInstance = axios.create({
    baseURL,
    timeout: 30000
  });

  // Request interceptor: Add JWT
  axiosInstance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: Handle errors + refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Token expired: redirect to login
        window.location.href = '/authentication';
      }
      return Promise.reject(error);
    }
  );

  return (
    <ApiContext.Provider value={axiosInstance}>
      {children}
    </ApiContext.Provider>
  );
}
```

### OfflineContext (Offline State + Sync)

```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { listenToOnlineStatus, getSyncQueue } from '../offline/sync';

interface OfflineContextType {
  isOnline: boolean;
  pendingSync: number;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    // Listen to online/offline events
    const unsubscribe = listenToOnlineStatus(
      (online) => {
        setIsOnline(online);
        if (online && pendingSync > 0) {
          syncNow();
        }
      }
    );

    // Update pending count
    getSyncQueue().then(queue => setPendingSync(queue.length));

    return unsubscribe;
  }, []);

  const syncNow = async () => {
    // Trigger sync
  };

  return (
    <OfflineContext.Provider value={{ isOnline, pendingSync, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}
```

---

## 5.5 Custom Hooks (Logic Extraction)

### useForm Hook (Reusable Form State)

```typescript
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>,
  validate?: (values: T) => Record<string, string>,
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Live validation
      if (validate) {
        const newErrors = validate({ ...values, [name]: value });
        setErrors(newErrors);
      }
    },
    [values, validate],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (validate) {
        const newErrors = validate(values);
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;
      }

      setLoading(true);
      try {
        await onSubmit(values);
      } catch (error) {
        // Error handling
      } finally {
        setLoading(false);
      }
    },
    [values, onSubmit, validate],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    setValues,
    errors,
    touched,
    loading,
    handleChange,
    handleSubmit,
    reset,
  };
}
```

### useIndexedDB Hook (Offline Data Access)

```typescript
import { useEffect, useState } from "react";
import { idb } from "../offline/db";

export function useIndexedDB<T>(
  storeName: "plans" | "assignments" | "exams" | "queue",
  query?: any,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = query
          ? await idb[storeName].getWhere(query)
          : await idb[storeName].getAll();
        setData(result);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storeName, query]);

  const add = async (record: T) => {
    await idb[storeName].add(record);
    setData((prev) => [...prev, record]);
  };

  const update = async (key: string, changes: Partial<T>) => {
    await idb[storeName].update(key, changes);
    setData((prev) =>
      prev.map((item) => (item.id === key ? { ...item, ...changes } : item)),
    );
  };

  const remove = async (key: string) => {
    await idb[storeName].delete(key);
    setData((prev) => prev.filter((item) => item.id !== key));
  };

  return { data, loading, add, update, remove };
}
```

---

## 5.6 Offline Support Architecture

### IndexedDB Schema (db.ts)

```typescript
import { IDBPDatabase, openDB } from "idb";

export interface PlanRecord {
  id: string;
  public_id: string;
  plan_json: string;
  created_at: number;
  updated_at: number;
  sync_status: "synced" | "pending" | "error";
  synced_at?: number;
}

export interface SyncQueueEntry {
  id: string;
  artifact_type: "lesson_plan" | "assignment" | "exam";
  artifact_public_id: string;
  operation: "create" | "update" | "delete";
  payload: string;
  priority: number;
  retry_count: number;
  created_at: number;
  last_error?: string;
}

let db: IDBPDatabase<DBSchema>;

export async function initIndexedDB() {
  db = await openDB("tutor-helper", 1, {
    upgrade(db) {
      // Plans store
      if (!db.objectStoreNames.contains("plans")) {
        const planStore = db.createObjectStore("plans", { keyPath: "id" });
        planStore.createIndex("by_public_id", "public_id", { unique: true });
        planStore.createIndex("by_sync_status", "sync_status");
        planStore.createIndex("by_updated_at", "updated_at");
      }

      // Assignments store
      if (!db.objectStoreNames.contains("assignments")) {
        const assignStore = db.createObjectStore("assignments", {
          keyPath: "id",
        });
        assignStore.createIndex("by_public_id", "public_id", { unique: true });
      }

      // Exams store
      if (!db.objectStoreNames.contains("exams")) {
        const examStore = db.createObjectStore("exams", { keyPath: "id" });
        examStore.createIndex("by_public_id", "public_id", { unique: true });
      }

      // Sync queue
      if (!db.objectStoreNames.contains("queue")) {
        const queueStore = db.createObjectStore("queue", { keyPath: "id" });
        queueStore.createIndex("by_priority", "priority");
        queueStore.createIndex("by_status", "status");
      }

      // References (for lookups)
      if (!db.objectStoreNames.contains("references")) {
        db.createObjectStore("references", { keyPath: "key", unique: true });
      }

      // Key-value store
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv", { keyPath: "key" });
      }
    },
  });
}

export async function savePlanOffline(plan: PlanRecord) {
  return db.put("plans", plan);
}

export async function getPlanOffline(public_id: string) {
  return db.getFromIndex("plans", "by_public_id", public_id);
}

export async function addToSyncQueue(entry: SyncQueueEntry) {
  return db.add("queue", entry);
}

export async function getSyncQueue() {
  return db.getAll("queue");
}
```

### Service Worker Registration

```typescript
// In main.tsx or App.tsx
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/offline-sw.js")
      .then((reg) => console.log("SW registered"))
      .catch((err) => console.error("SW registration failed", err));
  });
}
```

---

## 5.7 Component Patterns

### Controlled Form Component

```typescript
interface LessonFormProps {
  onSubmit: (data: LessonPlanRequest) => Promise<void>;
  initialValues?: Partial<LessonPlanRequest>;
  isLoading?: boolean;
}

const LessonForm: React.FC<LessonFormProps> = ({
  onSubmit,
  initialValues,
  isLoading = false
}) => {
  const form = useForm(
    {
      lesson_title: initialValues?.lesson_title || '',
      lesson_content: initialValues?.lesson_content || '',
      subject: initialValues?.subject || '',
      grade: initialValues?.grade || '',
      duration_minutes: initialValues?.duration_minutes || 45,
      plan_type: initialValues?.plan_type || 'traditional'
    },
    onSubmit,
    validateLessonForm
  );

  return (
    <form onSubmit={form.handleSubmit}>
      <FormField
        label="عنوان الدرس"
        name="lesson_title"
        value={form.values.lesson_title}
        onChange={form.handleChange}
        error={form.touched.lesson_title && form.errors.lesson_title}
      />

      <FormField
        label="محتوى الدرس"
        name="lesson_content"
        type="textarea"
        value={form.values.lesson_content}
        onChange={form.handleChange}
        error={form.touched.lesson_content && form.errors.lesson_content}
      />

      <button type="submit" disabled={isLoading || Object.keys(form.errors).length > 0}>
        {isLoading ? 'جاري التوليد...' : 'توليد الخطة'}
      </button>
    </form>
  );
};
```

---

## Summary

The frontend is:

- **Component-Based** — Reusable UI components with clear props
- **Hooks-Driven** — Custom hooks for logic extraction + reuse
- **Offline-First** — Full IndexedDB support + service workers
- **Type-Safe** — 250+ TypeScript definitions
- **Context-Based** — Auth, API, Offline, Notifications via React Context
- **Responsive** — Mobile-ready design (implied by structure)

---

**Next:** Read **06_BUSINESS_LOGIC.md** to understand core workflows.
