// Online rooms with Firebase Realtime Database (shared kit file – for games
// played on many devices at once, e.g. phones + a big screen).
//
// const me = await online.connect();      // anonymous player id, no names
// const code = await online.createRoom(); // big screen: a free 4-digit room code
// await online.roomExists('1234');        // phone: is there such a room?
// online.watch('rooms/1234/state', (s) => …)          // called on every change
// online.write / patch / add / remove / removeOnLeave // see below
//
// Only these paths are allowed (database.rules.json): rooms/<code>/
//   createdAt, hostUid, phase, state (host only), players/<uid> (that player),
//   inputs/<station> (the player at that station), commands/<id> (players add, host removes).
// Never store names, typed text or anything personal.

import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, signInAnonymously } from 'firebase/auth';
import {
  endAt,
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const DAY = 24 * 60 * 60 * 1000;
let me: Promise<string> | null = null;

export const online = {
  /** Signs in anonymously and returns this device's player id.
   *  Inside an iframe (the ?testi view) every frame gets its own id. */
  connect(): Promise<string> {
    me ??= (async () => {
      if (window.self !== window.top) await setPersistence(auth, inMemoryPersistence);
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    })();
    return me;
  },

  /** Makes a new room with a free 4-digit code; this device is its host.
   *  Deletes rooms older than a day first. */
  async createRoom(): Promise<string> {
    const uid = await online.connect();
    await cleanOldRooms();
    for (;;) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const result = await runTransaction(ref(db, `rooms/${code}`), (room) =>
        room === null ? { createdAt: serverTimestamp(), hostUid: uid } : undefined,
      );
      if (result.committed) return code;
    }
  },

  async roomExists(code: string): Promise<boolean> {
    await online.connect();
    return (await get(ref(db, `rooms/${code}/hostUid`))).exists();
  },

  /** Calls onChange with the value now and after every change. Returns a stop function. */
  watch<T>(path: string, onChange: (value: T | null) => void): () => void {
    return onValue(ref(db, path), (snap) => onChange(snap.val() as T | null));
  },

  /** Calls onAdd for every child that exists or is added later (e.g. commands). */
  watchAdded<T>(path: string, onAdd: (key: string, value: T) => void): () => void {
    return onChildAdded(ref(db, path), (snap) => onAdd(snap.key!, snap.val() as T));
  },

  /** Replaces the value at path. */
  write(path: string, value: unknown): Promise<void> {
    return set(ref(db, path), value);
  },

  /** Changes only the given keys at path. */
  patch(path: string, changes: Record<string, unknown>): Promise<void> {
    return update(ref(db, path), changes);
  },

  /** Adds a new child with an automatic, time-ordered key. */
  add(path: string, value: unknown): Promise<void> {
    return push(ref(db, path), value).then(() => undefined);
  },

  remove(path: string): Promise<void> {
    return remove(ref(db, path));
  },

  /** Removes path when this device goes offline (tab closed, phone asleep too long). */
  removeOnLeave(path: string): Promise<void> {
    return onDisconnect(ref(db, path)).remove();
  },

  /** Put this in a value to store Firebase's own clock time. */
  serverTime: serverTimestamp,
};

async function cleanOldRooms() {
  const old = await get(query(ref(db, 'rooms'), orderByChild('createdAt'), endAt(Date.now() - DAY)));
  const deletes: Promise<void>[] = [];
  old.forEach((room) => {
    deletes.push(remove(room.ref).catch(() => {})); // a wrong clock may make one too new; fine
  });
  await Promise.all(deletes);
}
