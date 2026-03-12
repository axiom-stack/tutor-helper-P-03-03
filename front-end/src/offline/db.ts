import { openDB } from 'idb';
import type {
  OfflineAssignmentRecord,
  OfflineCounterRecord,
  OfflineDraftRecord,
  OfflineExamRecord,
  OfflineLessonPlanRecord,
  OfflineQueueAction,
  OfflineReferenceRecord,
} from './types';

const DB_NAME = 'tutor-helper-offline';
const DB_VERSION = 1;

export type OfflineStoreName =
  | 'plans'
  | 'assignments'
  | 'exams'
  | 'drafts'
  | 'queue'
  | 'references'
  | 'kv';

export async function getOfflineDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('plans')) {
        const store = db.createObjectStore('plans', { keyPath: 'local_id' });
        store.createIndex('by_public_id', 'public_id', { unique: true });
        store.createIndex('by_server_id', 'server_id');
        store.createIndex('by_sync_status', 'sync_status');
        store.createIndex('by_updated_at', 'updated_at');
      }

      if (!db.objectStoreNames.contains('assignments')) {
        const store = db.createObjectStore('assignments', { keyPath: 'local_id' });
        store.createIndex('by_public_id', 'public_id', { unique: true });
        store.createIndex('by_server_id', 'server_id');
        store.createIndex('by_sync_status', 'sync_status');
        store.createIndex('by_updated_at', 'updated_at');
      }

      if (!db.objectStoreNames.contains('exams')) {
        const store = db.createObjectStore('exams', { keyPath: 'local_id' });
        store.createIndex('by_public_id', 'public_id', { unique: true });
        store.createIndex('by_server_id', 'server_id');
        store.createIndex('by_sync_status', 'sync_status');
        store.createIndex('by_updated_at', 'updated_at');
      }

      if (!db.objectStoreNames.contains('drafts')) {
        const store = db.createObjectStore('drafts', { keyPath: 'draft_id' });
        store.createIndex('by_route_key', 'route_key');
        store.createIndex('by_record_local_id', 'record_local_id');
        store.createIndex('by_updated_at', 'updated_at');
      }

      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'queue_id' });
        store.createIndex('by_status', 'status');
        store.createIndex('by_created_at', 'created_at');
        store.createIndex('by_target_local_id', 'target_local_id');
      }

      if (!db.objectStoreNames.contains('references')) {
        const store = db.createObjectStore('references', { keyPath: 'cache_key' });
        store.createIndex('by_kind', 'kind');
        store.createIndex('by_updated_at', 'updated_at');
      }

      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    },
  });
}

export type OfflineRecordStoreMap = {
  plans: OfflineLessonPlanRecord;
  assignments: OfflineAssignmentRecord;
  exams: OfflineExamRecord;
  drafts: OfflineDraftRecord;
  queue: OfflineQueueAction;
  references: OfflineReferenceRecord;
  kv: OfflineCounterRecord;
};

