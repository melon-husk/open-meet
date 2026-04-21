export interface TranscriptSegment {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  lang?: string;
  segments: TranscriptSegment[];
  notes: string;
  summary: string;
  status: "recording" | "recorded" | "summarizing" | "done" | "summary_failed";
}

const DB_NAME = "open-meet";
const DB_VERSION = 2;
const STORE_NAME = "meetings";
const SETTINGS_STORE = "settings";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function saveMeeting(meeting: Meeting): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").put(meeting);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Atomically append a segment to a meeting's segments array in IndexedDB. */
export async function appendSegment(
  meetingId: string,
  segment: TranscriptSegment
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const getReq = store.get(meetingId);
    getReq.onsuccess = () => {
      const meeting = getReq.result as Meeting | undefined;
      if (!meeting) {
        reject(new Error(`Meeting ${meetingId} not found`));
        return;
      }
      meeting.segments.push(segment);
      const putReq = store.put(meeting);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Update specific fields on a meeting without overwriting segments. */
export async function updateMeetingFields(
  meetingId: string,
  fields: Partial<Omit<Meeting, "id">>
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const getReq = store.get(meetingId);
    getReq.onsuccess = () => {
      const meeting = getReq.result as Meeting | undefined;
      if (!meeting) {
        reject(new Error(`Meeting ${meetingId} not found`));
        return;
      }
      Object.assign(meeting, fields);
      const putReq = store.put(meeting);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").get(id);
    req.onsuccess = () => resolve(req.result as Meeting | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").index("date").openCursor(null, "prev");
    const results: Meeting[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as Meeting);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Settings helpers ---

function settingsTx(
  db: IDBDatabase,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(SETTINGS_STORE, mode).objectStore(SETTINGS_STORE);
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = settingsTx(db, "readwrite").put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = settingsTx(db, "readonly").get(key);
    req.onsuccess = () => {
      const result = req.result as { key: string; value: string } | undefined;
      resolve(result?.value);
    };
    req.onerror = () => reject(req.error);
  });
}
