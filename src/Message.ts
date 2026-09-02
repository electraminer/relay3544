import type { Image } from "./spoilers/Image";
import type { Song } from "./spoilers/Song";

export interface Message {
  // When the message was recieved.
  receivedAt: number;
  // The numeric id of the message (visual only for reference)
  id: number;
  // The sender of the message (decimal form)
  sender: number;
  // The signals of the message
  signals: number[];
  // Tags of the message added by post processing
  tags: string[];
  // Image of the message added by post processing
  image?: Image;
  // Song of the message added by post processing
  song?: Song;
  songSignals?: number[];
}

// --- IndexedDB persistence for the message history --------------------------

const DB_NAME = "relay";
const DB_VERSION = 1;
const STORE_NAME = "messages";
// Messages used to live as a single JSON blob in localStorage. It is imported
// into IndexedDB once; this flag stops us from doing it again.
const LEGACY_STORAGE_KEY = "relay-messages";
const LEGACY_MIGRATED_KEY = "relay-messages-migrated";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Keys come from the store's auto-increment generator, so they grow
        // monotonically with insertion order (first key is 1).
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Append a message to the store, returning the key it was given. */
export async function appendStoredMessage(message: Message): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const key = await idbRequest<IDBValidKey>(
    tx.objectStore(STORE_NAME).add(message),
  );
  await txDone(tx);
  return key as number;
}

/**
 * Walk the store from newest to oldest with a single reverse cursor, collecting
 * messages that satisfy `match` until `limit` of them have been gathered (or the
 * store runs out). Only one record is held at a time — nothing is read in bulk.
 *
 * @param startKey Key to begin at, inclusive; records with a larger key are
 *                 skipped. Pass a non-finite number (e.g. `Infinity`) to start
 *                 from the newest message.
 * @param match    Kept only when this returns true for the message.
 * @param limit    Stop once this many messages have been collected.
 * @returns an object containing:
 *  `all` - all read messages.
 *  `filtered` - the messages matching the filter.
 *  `nextKey` - the next key to read to continue iteration.
 */
export async function loadRecentMessages(
  match: (message: Message) => boolean,
  limit: number,
  startKey?: number,
): Promise<{ all: Message[]; filtered: Message[]; nextKey: number }> {
  const all: Message[] = [];
  const filtered: Message[] = [];
  startKey ??= Infinity;
  if (limit <= 0) return { all, filtered, nextKey: startKey };

  const db = await openDb();
  const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
  const range = IDBKeyRange.upperBound(startKey);

  return new Promise((resolve, reject) => {
    const request = store.openCursor(range, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({
          all: all.toReversed(),
          filtered: filtered.toReversed(),
          nextKey: -1,
        });
        return;
      }
      const message = cursor.value as Message;
      all.push(message);
      if (match(message)) filtered.push(message);
      if (filtered.length >= limit) {
        resolve({
          all: all.toReversed(),
          filtered: filtered.toReversed(),
          nextKey: (cursor.key as number) - 1,
        });
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import the old localStorage message blob into IndexedDB, once, one append at
 * a time, then clear the blob.
 */
async function migrateLegacyMessages(): Promise<void> {
  if (localStorage.getItem(LEGACY_MIGRATED_KEY) === "true") return;
  let legacy: Message[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) legacy = parsed as Message[];
  } catch (e) {
    console.log("message migration error", e);
  }
  for (const message of legacy) await appendStoredMessage(message);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
}

/**
 * The chat's message history, backed by IndexedDB.
 *
 * New messages are appended with {@link MessageHistory.add}. Reads are lazy:
 * {@link MessageHistory.get} memoizes by key, and the async iterator walks from
 * the newest message to the oldest, fetching exactly one message per step and
 * only when asked — messages are never loaded in bulk. `version` changes on
 * every mutation so React consumers know when to re-read.
 */
export class MessageHistory {
  /** Saved message list */
  private history: Message[] = [];
  /** The next key to be loaded, going backward, if the user loads further into the past. */
  private nextKey: number;
  /** Resolves once the one-time localStorage migration has finished. */
  readonly ready: Promise<void>;
  /** Called whenever the message history is updated. */
  private onUpdate: () => void;
  version: number;

  constructor(onUpdate: () => void) {
    this.ready = migrateLegacyMessages()
      .then(onUpdate)
      .catch((e) => console.log("message migration error", e));
    this.nextKey = Infinity;
    this.version = 0;
    this.onUpdate = () => {
      onUpdate();
      this.version++;
    };
  }

  /** Append a message to the end of the history and persist it. */
  add(message: Message) {
    this.history.push(message);
    this.onUpdate();
    // Asynchronously add the message to the DB, no need to wait for it because it's already cached.
    this.ready.then(() => appendStoredMessage(message));
  }

  getLoadedMessages(
    limit: number,
    filter?: (message: Message) => boolean,
  ): Message[] {
    filter ??= () => true;
    let messages = [];
    for (let i = this.history.length - 1; i >= 0; i--) {
      const message = this.history[i];
      if (filter(message)) messages.push(message);
      if (messages.length >= limit) return messages.toReversed();
    }

    return messages.toReversed();
  }

  async loadMoreMessages(
    limit: number,
    filter?: (message: Message) => boolean,
  ): Promise<Message[]> {
    filter ??= () => true;
    await this.ready;

    const { all, filtered, nextKey } = await loadRecentMessages(
      filter,
      limit,
      this.nextKey,
    );
    if (this.nextKey > nextKey) {
      this.nextKey = nextKey;
      this.history.splice(0, 0, ...all);
      this.onUpdate();
    }

    return filtered;
  }

  getMessagesAndLoadLater(
    limit: number,
    filter?: (message: Message) => boolean,
  ): Message[] {
    const messages = this.getLoadedMessages(limit, filter);
    // Asynchronously start loading the missing messages, but don't wait for them
    this.loadMoreMessages(limit - messages.length, filter);

    return messages;
  }

  async getMessages(
    limit: number,
    filter?: (message: Message) => boolean,
  ): Promise<Message[]> {
    const messages = this.getLoadedMessages(limit, filter);
    const newMessages = await this.loadMoreMessages(
      limit - messages.length,
      filter,
    );
    return [...newMessages, ...messages];
  }
}
