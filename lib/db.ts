export interface TranscriptSegment {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  segments: TranscriptSegment[];
  notes: string;
  summary: string;
  status: "recording" | "summarizing" | "done" | "summary_failed";
}

const DB_NAME = "open-meet";
const DB_VERSION = 1;
const STORE_NAME = "meetings";

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
