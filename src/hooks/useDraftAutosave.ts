import { useCallback, useEffect, useRef } from "react";

/**
 * Bulletproof draft autosave hook.
 *
 * - Dual storage: localStorage (sync, fast) + IndexedDB (resilient backup)
 * - Debounced auto-save (200ms) on every data change
 * - Synchronous flush on `beforeunload`, `pagehide`, and tab hidden
 *   so nothing is lost on crash, navigation, or network drop
 * - DB save success must be confirmed by the caller before `clear()` is invoked
 */

const DB_NAME = "lovable_drafts";
const DB_STORE = "drafts";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const idbSet = async (key: string, value: string) => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB is best-effort; localStorage already holds the data */
  }
};

const idbGet = async (key: string): Promise<string | null> => {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

const idbDel = async (key: string) => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
};

export interface DraftEnvelope<T> {
  data: T;
  updatedAt: string;
  version: number;
}

export interface UseDraftAutosaveApi<T> {
  /** Force a synchronous flush of the latest data. */
  flush: () => void;
  /** Restore the most recent draft from localStorage or IndexedDB. */
  restore: () => Promise<DraftEnvelope<T> | null>;
  /** Clear the draft from both stores (call after a confirmed DB save). */
  clear: () => Promise<void>;
}

/**
 * @param key       Unique storage key (e.g. `note:new`, `note:edit:<id>`).
 * @param data      The current data to persist (must be JSON-serializable).
 * @param enabled   Skip persistence (e.g. while initial DB load is pending).
 * @param shouldSave Optional predicate; when false, the autosave skip writes.
 */
export function useDraftAutosave<T>(
  key: string,
  data: T,
  enabled: boolean,
  shouldSave: (data: T) => boolean = () => true,
): UseDraftAutosaveApi<T> {
  const dataRef = useRef(data);
  const enabledRef = useRef(enabled);
  const shouldSaveRef = useRef(shouldSave);
  const keyRef = useRef(key);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;
  enabledRef.current = enabled;
  shouldSaveRef.current = shouldSave;
  keyRef.current = key;

  const writeNow = useCallback(() => {
    if (!enabledRef.current || !keyRef.current) return;
    const current = dataRef.current;
    if (!shouldSaveRef.current(current)) return;
    const envelope: DraftEnvelope<T> = {
      data: current,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(envelope);
    } catch {
      return;
    }
    try {
      localStorage.setItem(keyRef.current, serialized);
    } catch {
      /* quota exceeded — IndexedDB still tries below */
    }
    void idbSet(keyRef.current, serialized);
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (!enabled || !key) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(writeNow, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, key, writeNow]);

  // Forced flush on tab close / hide
  useEffect(() => {
    const handler = () => writeNow();
    const visHandler = () => {
      if (document.visibilityState === "hidden") writeNow();
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    document.addEventListener("visibilitychange", visHandler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
      document.removeEventListener("visibilitychange", visHandler);
    };
  }, [writeNow]);

  const restore = useCallback(async (): Promise<DraftEnvelope<T> | null> => {
    if (!key) return null;
    const parse = (raw: string | null): DraftEnvelope<T> | null => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && "data" in parsed) {
          return parsed as DraftEnvelope<T>;
        }
      } catch {
        /* ignore */
      }
      return null;
    };
    const local = parse(localStorage.getItem(key));
    const remote = parse(await idbGet(key));
    if (!local && !remote) return null;
    if (local && remote) {
      return new Date(local.updatedAt).getTime() >= new Date(remote.updatedAt).getTime()
        ? local
        : remote;
    }
    return local ?? remote;
  }, [key]);

  const clear = useCallback(async () => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    await idbDel(key);
  }, [key]);

  return { flush: writeNow, restore, clear };
}