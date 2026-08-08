/** IndexedDB for Desk OS (files, calendar, mail). Local only. */

const DB_NAME = 'mindcraft-desk-os';
const DB_VERSION = 3;
const STORE_META = 'items';
const STORE_BLOBS = 'blobs';
const STORE_EVENTS = 'events';
const STORE_MAIL = 'mail';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        const store = db.createObjectStore(STORE_META, { keyPath: 'id' });
        store.createIndex('byCourse', 'courseId', { unique: false });
        store.createIndex('byDate', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const ev = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        ev.createIndex('byDate', 'date', { unique: false });
        ev.createIndex('bySemester', 'semesterId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MAIL)) {
        const mail = db.createObjectStore(STORE_MAIL, { keyPath: 'id' });
        mail.createIndex('byKind', 'kind', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveItem(item, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_META).put(item);
    if (blob) {
      tx.objectStore(STORE_BLOBS).put({ id: item.id, blob, mime: item.mime });
    }
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_META).delete(id);
    tx.objectStore(STORE_BLOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listEvents() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const req = tx.objectStore(STORE_EVENTS).getAll();
    req.onsuccess = () => {
      const events = req.result || [];
      events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      resolve(events);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveEvents(events) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    for (const ev of events) store.put(ev);
    tx.oncomplete = () => resolve(events);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearEvents() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    tx.objectStore(STORE_EVENTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listMail() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MAIL, 'readonly');
    const req = tx.objectStore(STORE_MAIL).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMail(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MAIL, 'readwrite');
    tx.objectStore(STORE_MAIL).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMailMany(entries) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MAIL, 'readwrite');
    const store = tx.objectStore(STORE_MAIL);
    for (const e of entries) store.put(e);
    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteMail(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MAIL, 'readwrite');
    tx.objectStore(STORE_MAIL).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
