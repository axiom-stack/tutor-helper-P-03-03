# 10. OFFLINE SUPPORT & DATA SYNCHRONIZATION

## 10.1 Offline Architecture Overview

### Online/Offline Models

```
┌─────────────────────┬────────────────────┬──────────────────────┐
│    STATE            │    BEHAVIOR         │   STORAGE            │
├─────────────────────┼────────────────────┼──────────────────────┤
│                     │                    │                      │
│ ONLINE              │ • API calls to     │ • Server database    │
│ (Connected)         │   backend         │ • Browser cache      │
│                     │ • Instant sync     │ • IndexedDB          │
│                     │ • Real-time errors │                      │
│                     │                    │                      │
├─────────────────────┼────────────────────┼──────────────────────┤
│                     │                    │                      │
│ OFFLINE             │ • Queue operations │ • IndexedDB only     │
│ (Disconnected)      │ • Show local data  │ • LocalStorage       │
│                     │ • Defer sync       │ • In-memory cache    │
│                     │ • Local timestamps │                      │
│                     │                    │                      │
└─────────────────────┴────────────────────┴──────────────────────┘

Transitions:
Online → Offline:  Network error caught, show banner
Offline → Online:  Check queue, start sync, update statuses
```

---

## 10.2 IndexedDB Schema

### Database Structure

```typescript
// front-end/src/offline/db.ts

interface DBSchema {
  plans: {
    key: string;
    value: PlanRecord;
    indexes: {
      by_public_id: string;
      by_sync_status: string;
      by_updated_at: number;
    };
  };

  assignments: {
    key: string;
    value: AssignmentRecord;
    indexes: {
      by_public_id: string;
      by_lesson_id: string;
    };
  };

  exams: {
    key: string;
    value: ExamRecord;
    indexes: {
      by_public_id: string;
      by_class_id: string;
    };
  };

  queue: {
    key: string;
    value: SyncQueueEntry;
    indexes: {
      by_priority: number;
      by_status: string;
      by_created_at: number;
    };
  };

  references: {
    key: string;
    value: {
      key: string;
      type: "classroom" | "subject" | "unit" | "lesson";
      data: any;
    };
  };

  kv: {
    key: string;
    value: {
      key: string;
      value: any;
      timestamp: number;
    };
  };
}

export interface PlanRecord {
  id: string;
  public_id: string;
  teacher_id: number;
  lesson_title: string;
  subject: string;
  grade: string;
  plan_json: string; // JSON stringified
  validation_status: string;
  retry_occurred: boolean;
  created_at: number;
  updated_at: number;
  sync_status: "synced" | "pending" | "error";
  synced_at?: number;
  last_error?: string;
}

export interface SyncQueueEntry {
  id: string;
  artifact_type: "lesson_plan" | "assignment" | "exam";
  artifact_public_id: string;
  operation: "create" | "update" | "delete";
  payload: string; // JSON stringified
  priority: number; // 1 = high, 10 = low
  retry_count: number;
  last_retry_at?: number;
  last_error?: string;
  created_at: number;
}

// Database initialization
export async function initIndexedDB() {
  const db = await openDB<DBSchema>("tutor-helper", 1, {
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
        assignStore.createIndex("by_lesson_id", "lesson_id");
      }

      // Exams store
      if (!db.objectStoreNames.contains("exams")) {
        const examStore = db.createObjectStore("exams", { keyPath: "id" });
        examStore.createIndex("by_public_id", "public_id", { unique: true });
        examStore.createIndex("by_class_id", "class_id");
      }

      // Sync queue
      if (!db.objectStoreNames.contains("queue")) {
        const queueStore = db.createObjectStore("queue", { keyPath: "id" });
        queueStore.createIndex("by_priority", "priority");
        queueStore.createIndex("by_status", "status");
        queueStore.createIndex("by_created_at", "created_at");
      }

      // References (for dropdown data)
      if (!db.objectStoreNames.contains("references")) {
        db.createObjectStore("references", { keyPath: "key", unique: true });
      }

      // Key-value store
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv", { keyPath: "key" });
      }
    },
  });

  return db;
}
```

---

## 10.3 Service Worker for Offline Support

### Service Worker Registration & Caching

```typescript
// public/offline-sw.js

const CACHE_NAME = "tutor-helper-v1";
const API_CACHE_NAME = "tutor-helper-api-v1";

const urlsToCache = [
  "/",
  "/index.html",
  "/main.tsx",
  "/App.tsx",
  "/offline.html", // Fallback page
];

// Install event: Cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()),
  );
});

// Activate event: Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event: Network-first strategy for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.url.includes("/api/")) {
    // API requests: Network first, fallback to cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches
              .open(API_CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches
            .match(request)
            .then(
              (response) =>
                response ||
                new Response(JSON.stringify({ error: "offline" }), {
                  headers: { "Content-Type": "application/json" },
                }),
            );
        }),
    );
  } else {
    // Static assets: Cache first
    event.respondWith(
      caches
        .match(request)
        .then((response) => response || fetch(request))
        .catch(
          () =>
            new Response("Offline - Resource not available", { status: 503 }),
        ),
    );
  }
});
```

---

## 10.4 Sync Manager

### Queue Processing & Reconciliation

```typescript
// front-end/src/offline/sync.ts

export class SyncManager {
  constructor(private db: IDBPDatabase<DBSchema>) {}

  /**
   * Add operation to sync queue when offline
   */
  async queueForSync(
    artifactType: "lesson_plan" | "assignment" | "exam",
    operation: "create" | "update" | "delete",
    payload: any,
    priority = 5,
  ) {
    const entry: SyncQueueEntry = {
      id: generateUUID(),
      artifact_type: artifactType,
      artifact_public_id: payload.public_id || generateUUID(),
      operation,
      payload: JSON.stringify(payload),
      priority,
      retry_count: 0,
      created_at: Date.now(),
    };

    await this.db.add("queue", entry);
    console.log(`📥 Queued ${operation} of ${artifactType}`);
  }

  /**
   * Process sync queue (called when coming online)
   */
  async processSyncQueue() {
    const queueEntries = await this.db.getAll("queue");

    if (queueEntries.length === 0) {
      console.log("✅ Sync queue is empty");
      return { successful: 0, failed: 0 };
    }

    console.log(`🔄 Processing ${queueEntries.length} queued operations...`);

    // Sort by priority (high priority first)
    queueEntries.sort((a, b) => a.priority - b.priority);

    let successful = 0;
    let failed = 0;

    for (const entry of queueEntries) {
      try {
        const result = await this.syncSingleEntry(entry);
        if (result.success) {
          // Remove from queue
          await this.db.delete("queue", entry.id);
          successful++;
        } else {
          // Update retry count + error
          await this.db.put("queue", {
            ...entry,
            retry_count: entry.retry_count + 1,
            last_retry_at: Date.now(),
            last_error: result.error,
          });
          failed++;
        }
      } catch (error) {
        console.error("❌ Sync failed for entry:", entry.id, error);
        failed++;
      }
    }

    console.log(`✅ Sync complete: ${successful} successful, ${failed} failed`);
    return { successful, failed };
  }

  /**
   * Sync a single queue entry
   */
  private async syncSingleEntry(entry: SyncQueueEntry) {
    const payload = JSON.parse(entry.payload);

    try {
      switch (entry.artifact_type) {
        case "lesson_plan":
          return await this.syncPlan(entry.operation, payload);
        case "assignment":
          return await this.syncAssignment(entry.operation, payload);
        case "exam":
          return await this.syncExam(entry.operation, payload);
        default:
          return { success: false, error: "Unknown artifact type" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async syncPlan(operation: string, payload: any) {
    if (operation === "create") {
      const response = await axiosInstance.post("/api/generate-plan", payload);
      // Update IndexedDB record with server response
      await this.db.put("plans", {
        ...payload,
        public_id: response.data.public_id,
        sync_status: "synced",
        synced_at: Date.now(),
      });
      return { success: true };
    }
    // ... handle update, delete
  }

  private async syncAssignment(operation: string, payload: any) {
    // Similar to syncPlan
  }

  private async syncExam(operation: string, payload: any) {
    // Similar to syncPlan
  }
}

// Network status listener
export function listenToOnlineStatus(callback: (isOnline: boolean) => void) {
  window.addEventListener("online", () => callback(true));
  window.addEventListener("offline", () => callback(false));

  // Initial status
  callback(navigator.onLine);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", () => {});
    window.removeEventListener("offline", () => {});
  };
}
```

---

## 10.5 Offline Context Integration

### Hook Usage in Components

```typescript
export function usePlanCreatorWithOffline() {
  const { isOnline } = useOffline();
  const dbManager = useIndexedDB("plans");
  const [saving, setSaving] = useState(false);

  const savePlan = async (formData: LessonPlanRequest) => {
    setSaving(true);

    try {
      if (isOnline) {
        // Online: Direct API call
        const response = await axiosInstance.post(
          "/api/generate-plan",
          formData,
        );

        // Also cache locally
        await dbManager.add({
          id: response.data.public_id,
          ...response.data,
          sync_status: "synced",
          synced_at: Date.now(),
        });

        return response.data;
      } else {
        // Offline: Save to IndexedDB + queue
        const localPlan = {
          id: generateUUID(),
          public_id: generateUUID(),
          ...formData,
          sync_status: "pending",
          created_at: Date.now(),
          updated_at: Date.now(),
        };

        await dbManager.add(localPlan);

        // Queue for sync
        await syncManager.queueForSync(
          "lesson_plan",
          "create",
          localPlan,
          (priority = 1),
        );

        toast.success("تم حفظ الخطة محلياً. سيتم مزامنة عند الاتصال");
        return localPlan;
      }
    } finally {
      setSaving(false);
    }
  };

  return { savePlan, saving, isOnline };
}
```

---

## 10.6 Conflict Resolution

### Handling Sync Conflicts

```typescript
export async function reconcileConflict(local: PlanRecord, remote: PlanRecord) {
  // Strategy 1: Last-write-wins (simple)
  if (local.updated_at > remote.updated_at) {
    return local; // Local is newer
  } else {
    return remote; // Remote is newer
  }

  // Strategy 2: Deep merge (complex)
  // For each field, take the newer value
  const merged = {
    ...remote,
    ...Object.entries(local).reduce((acc, [key, value]) => {
      if (local.updated_at > remote.updated_at) {
        acc[key] = value;
      }
      return acc;
    }, {}),
  };

  return merged;
}

/**
 * Detect data conflicts during sync
 */
export async function detectConflicts(
  localRecords: PlanRecord[],
  remoteRecords: PlanRecord[],
) {
  const conflicts: ConflictPair[] = [];

  for (const local of localRecords) {
    const remote = remoteRecords.find((r) => r.public_id === local.public_id);

    if (remote && local.updated_at !== remote.updated_at) {
      // Content changed both locally and remotely
      const localContent = JSON.stringify(JSON.parse(local.plan_json));
      const remoteContent = JSON.stringify(JSON.parse(remote.plan_json));

      if (localContent !== remoteContent) {
        conflicts.push({ local, remote });
      }
    }
  }

  return conflicts;
}
```

---

## Summary

Offline Support architecture:

- **IndexedDB:** Full local data persistence (all artifacts)
- **Service Worker:** Network caching + offline page fallback
- **Sync Queue:** Priority-based operation batching
- **Online Detection:** Automatic sync trigger on connectivity
- **Conflict Resolution:** Last-write-wins + deep merge strategies
- **User Feedback:** Banners showing sync status & results

---

**Next:** Read **11_AUTH_SECURITY.md** for authentication & permissions.
