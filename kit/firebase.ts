// Online rooms with Firebase Realtime Database (shared kit file – for games
// played on many devices at once, e.g. phones + a big screen).
//
// const me = await online.connect();      // anonymous player id, no names
// const code = await online.createRoom(); // big screen: a free 4-digit room code
// await online.roomExists('1234');        // phone: is there such a room?
// online.read('rooms/1234/phase')                    // the value once
// online.watch('rooms/1234/state', (s) => …)          // called on every change
// online.write / patch / add / remove / removeOnLeave // see below
//
// Every game has its own part of the database: the paths above really are
// games/<game folder>/rooms/…, worked out from the page address (games/avaruuskelkka/ →
// 'avaruuskelkka'). So games never see each other's rooms. Paths starting with '.'
// (like '.info/connected') are Firebase's own and are used as they are.
//
// Only these paths are allowed (database.rules.json), inside games/<game>/rooms/<code>/:
//   createdAt, hostUid, phase, state (host only), players/<uid> (that player),
//   inputs/<station> (the player at that station), commands/<id> (players add, host removes).
// Never store names, typed text or anything personal.
//
// Which Firebase project: firebase-web-config.json at the repo root (+ .firebaserc for the CLI).

import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, signInAnonymously, type Auth } from 'firebase/auth';
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
  type Database,
} from 'firebase/database';
import firebaseConfig from '../firebase-web-config.json';

/** This game's part of the database, from the address: …/games/<game>/… */
const game = location.pathname.match(/\/games\/([a-z]+)\//)?.[1] ?? 'yleinen';
/** 'rooms/1234' → 'games/<game>/rooms/1234' */
const at = (path: string) => (path.startsWith('.') ? path : `games/${game}/${path}`);

const DAY = 24 * 60 * 60 * 1000;
let me: Promise<string> | null = null;
let fb: { auth: Auth; db: Database } | null = null;

/** Starts Firebase the first time it is needed – or says clearly that it isn't set up. */
function firebase() {
  if (fb) return fb;
  const c = firebaseConfig as Record<string, string | undefined>;
  if (!c.apiKey || !c.projectId || !c.databaseURL || !c.appId) notConfigured();
  const app = initializeApp(firebaseConfig);
  fb = { auth: getAuth(app), db: getDatabase(app) };
  return fb;
}

function notConfigured(): never {
  const message = 'Firebase ei ole asetettu: täytä firebase-web-config.json (README.md → Firebase).';
  if (!document.getElementById('firebase-puuttuu')) {
    const box = document.createElement('div');
    box.id = 'firebase-puuttuu';
    box.textContent = `⚠️ ${message}`;
    Object.assign(box.style, {
      position: 'fixed', inset: '30% 10% auto 10%', zIndex: '100', padding: '24px', borderRadius: '16px',
      background: '#ffcc00', color: '#000', font: 'bold 20px system-ui, sans-serif', textAlign: 'center',
    });
    document.body.appendChild(box);
  }
  throw new Error(message);
}

const node = (path: string) => ref(firebase().db, at(path));

export const online = {
  /** The name of this game's part of the database (the game's folder name). */
  game,

  /** Signs in anonymously and returns this device's player id.
   *  Inside an iframe (the ?testi view) every frame gets its own id. */
  connect(): Promise<string> {
    me ??= (async () => {
      const { auth } = firebase();
      if (window.self !== window.top) await setPersistence(auth, inMemoryPersistence);
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    })();
    return me;
  },

  /** Makes a new room with a free 4-digit code; this device is its host.
   *  Deletes this game's rooms older than a day first. */
  async createRoom(): Promise<string> {
    const uid = await online.connect();
    await cleanOldRooms();
    for (;;) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const result = await runTransaction(node(`rooms/${code}`), (room) =>
        room === null ? { createdAt: serverTimestamp(), hostUid: uid } : undefined,
      );
      if (result.committed) return code;
    }
  },

  async roomExists(code: string): Promise<boolean> {
    await online.connect();
    return (await get(node(`rooms/${code}/hostUid`))).exists();
  },

  /** Reads the value at path once (null if there is nothing). */
  async read<T>(path: string): Promise<T | null> {
    await online.connect();
    return (await get(node(path))).val() as T | null;
  },

  /** Calls onChange with the value now and after every change. Returns a stop function. */
  watch<T>(path: string, onChange: (value: T | null) => void): () => void {
    return onValue(node(path), (snap) => onChange(snap.val() as T | null));
  },

  /** Calls onAdd for every child that exists or is added later (e.g. commands). */
  watchAdded<T>(path: string, onAdd: (key: string, value: T) => void): () => void {
    return onChildAdded(node(path), (snap) => onAdd(snap.key!, snap.val() as T));
  },

  /** Replaces the value at path. */
  write(path: string, value: unknown): Promise<void> {
    return set(node(path), value);
  },

  /** Changes only the given keys at path. */
  patch(path: string, changes: Record<string, unknown>): Promise<void> {
    return update(node(path), changes);
  },

  /** Adds a new child with an automatic, time-ordered key. */
  add(path: string, value: unknown): Promise<void> {
    return push(node(path), value).then(() => undefined);
  },

  remove(path: string): Promise<void> {
    return remove(node(path));
  },

  /** Removes path when this device goes offline (tab closed, phone asleep too long). */
  removeOnLeave(path: string): Promise<void> {
    return onDisconnect(node(path)).remove();
  },

  /** Put this in a value to store Firebase's own clock time. */
  serverTime: serverTimestamp,
};

async function cleanOldRooms() {
  const old = await get(query(node('rooms'), orderByChild('createdAt'), endAt(Date.now() - DAY)));
  const deletes: Promise<void>[] = [];
  old.forEach((room) => {
    deletes.push(remove(room.ref).catch(() => {})); // a wrong clock may make one too new; fine
  });
  await Promise.all(deletes);
}
