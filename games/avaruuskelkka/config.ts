// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// A goofy starship-bridge game: every phone is one station of the ship, the
// computer is the ship's main viewscreen. See README.md for which file does what.
// Distances are in pixels of the space map, speeds in pixels per second.

import type { ThemeName } from '@kit/themes';

export interface StationDef {
  /** Short id, lowercase a–z only (it is stored in Firebase). Don't change it in a running game. */
  id: string;
  /** Name shown on the phones and the main screen. */
  name: string;
  emoji: string;
  /** One line telling the player what this station does. */
  job: string;
}

export interface Waypoint {
  name: string;
  emoji: string;
  /** Place on the space map. The first one is where the trip starts, the last one is the goal. */
  x: number;
  y: number;
  /** Lots of rocks fly around near this place. */
  rocks?: boolean;
  /** A Möhköttäjä pirate attacks on the way to this place. */
  pirate?: boolean;
  /** Thick fog around this place: only Tiede can see the way. */
  fog?: boolean;
  /** Another place the Captain can choose to fly to instead of this one. */
  alt?: Waypoint;
}

export interface SecretDef {
  /** madonreika = wormhole shortcut, kristalli = bonus crystal */
  kind: 'madonreika' | 'kristalli';
  x: number;
  y: number;
  /** Wormhole: where it throws the ship, and which place on the route it flies to next. */
  exit?: { x: number; y: number; target: number };
}

export const config = {
  title: 'Avaruuskelkka',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'avaruus' as ThemeName,

  /** Laiva – the crew's spaceship. */
  ship: { name: 'USS Avaruuskelkka', emoji: '🚀', size: 150 },

  /** Konsolien värit – the bridge's console colours (rounded orange/lilac/blue panels). */
  lcars: ['#ff9900', '#cc99cc', '#9999ff', '#ff9966', '#ffcc99', '#cc6666', '#99ccff'],

  /** Asemat – the stations of the ship, in the order they are shown.
   *  A station nobody picks runs on autopilot. */
  stations: [
    { id: 'kapteeni', name: 'Kapteeni', emoji: '🧑‍✈️', job: 'Sano "Tehkää niin!" ja tee isot päätökset.' },
    { id: 'ohjaus', name: 'Ohjaus', emoji: '🕹️', job: 'Ohjaa laivaa ja väistele kiviä.' },
    { id: 'taktiikka', name: 'Taktiikka', emoji: '🛡️', job: 'Kilvet ylös ja lasereilla poks!' },
    { id: 'tiede', name: 'Tiede', emoji: '🔭', job: 'Skannaa avaruutta ja löydä salaisuudet.' },
    { id: 'operaatiot', name: 'Operaatiot', emoji: '📡', job: 'Seuraa hälytyksiä ja jaa tehtäviä.' },
    { id: 'viestinta', name: 'Viestintä', emoji: '👽', job: 'Juttele avaruusolioiden kanssa.' },
    { id: 'konehuone', name: 'Konehuone', emoji: '🔧', job: '"En pysty enempään, kapteeni!"' },
    { id: 'neuvonantaja', name: 'Neuvonantaja', emoji: '💖', job: 'Pidä miehistön mieli hyvänä.' },
  ] as StationDef[],

  /** How many players may share one station (when there are more players than stations). */
  playersPerStation: 2,

  /** Player colours: every phone gets the first free one. Lowercase #rrggbb only. */
  colours: ['#ffcc00', '#00d4ff', '#ff5ca8', '#7cff6b', '#ff8a3d', '#b48cff', '#ffffff', '#3dffd2', '#ff4d4d', '#c0c0c0'],

  /** Reitti – the trip from home to the goal planet. */
  route: [
    { name: 'Kotitelakka', emoji: '🛰️', x: 0, y: 0 },
    { name: 'Juustosumu', emoji: '🧀', x: 3200, y: -1300, pirate: true, fog: true },
    {
      name: 'Kivikaista', emoji: '🪨', x: 6400, y: 500, rocks: true,
      alt: { name: 'Hattarapilvet', emoji: '🍭', x: 5200, y: -3900 },
    },
    { name: 'Pörröpäiden asema', emoji: '👾', x: 9200, y: -1500 },
    { name: 'Avaruusvalaan laulupaikka', emoji: '🐋', x: 12000, y: 300, pirate: true },
    { name: 'Planeetta Kotikolo', emoji: '🪐', x: 15000, y: -700 },
  ] as Waypoint[],
  /** How close the ship must fly to a place to "arrive" there. */
  arriveDistance: 220,

  /** Ohjaus – how the ship flies. */
  helm: {
    /** Turning speed in degrees per second. */
    turnSpeed: 110,
    /** Speeds for the throttle buttons: SEIS, 1/4, 1/2, TÄYSI impulssi. */
    speeds: [0, 120, 220, 320],
    /** WARP! – very fast for a short time, then it has to charge. */
    warpSpeed: 1100,
    warpSeconds: 2.5,
    warpCharge: 20,
  },

  /** Vaarat – things that fly at the ship. Sizes in pixels, speeds in pixels per second. */
  danger: {
    /** Kivet: a new rock every this many seconds (fieldEvery near a place with rocks: true). */
    rock: { emoji: '🪨', every: 7, fieldEvery: 1.4, speed: 80, size: 95 },
    /** Möhköttäjä: a silly space pirate that circles the ship and throws pies. */
    pirate: { name: 'Möhköttäjä', emoji: '🛸', hp: 3, throwsEvery: 3, leavesAfter: 45, size: 140 },
    /** Avaruuspiirakka: what the pirate throws. PLÖRTS! */
    pie: { emoji: '🥧', speed: 280, size: 70 },
  },

  /** Taktiikka – lasers and shields. */
  tactical: {
    /** How far the laser reaches (the circle on the radar). */
    range: 700,
    /** Seconds between laser shots: reload − reloadPerPoint × weapon energy. */
    reload: 1.6,
    reloadPerPoint: 0.3,
    /** Seconds the shields stay up: shieldSeconds + shieldPerPoint × shield energy. */
    shieldSeconds: 2,
    shieldPerPoint: 1.5,
    /** Seconds the shields need to charge before they can go up again. */
    shieldCharge: 6,
  },

  /** Konehuone – energy and repairs. */
  energy: {
    /** Energy points to share between moottori, kilvet and aseet. */
    total: 6,
    /** Most points one system can have. */
    max: 4,
    start: { moottori: 2, kilvet: 2, aseet: 2 },
    /** Each engine point above 2 adds this much speed (0.15 = 15 %). */
    enginePerPoint: 0.15,
  },
  /** Viat – every hit without shields breaks something. Each one slows the ship a bit. */
  faults: {
    tapsToFix: 3,
    /** Speed lost per fault (0.1 = 10 %). */
    slowEach: 0.1,
    max: 6,
    names: ['💨 Moottori pörisee', '☕ Kahvinkeitin', '🚽 Vessa tulvii', '💡 Valot vilkkuu', '🌀 Tuuletin', '🧦 Sukka putkessa'],
  },

  /** Tiede – scanning finds hidden things and clears fog. */
  science: {
    /** How far a scan reaches. */
    scanRadius: 2000,
    /** Seconds to hold the scan button. */
    holdSeconds: 1.5,
    /** Seconds before the next scan. */
    scanCharge: 6,
    /** How long a scan keeps the fog away, and how big the fog is around a place with fog: true. */
    fogClear: 15,
    fogRadius: 2300,
  },

  /** Salaisuudet – hidden things that only a scan reveals. */
  secrets: [
    { kind: 'madonreika', x: 4600, y: -450, exit: { x: 8600, y: -1100, target: 3 } },
    { kind: 'kristalli', x: 1900, y: -1100 },
    { kind: 'kristalli', x: 5000, y: -900 },
    { kind: 'kristalli', x: 7800, y: -2300 },
    { kind: 'kristalli', x: 10600, y: -1100 },
    { kind: 'kristalli', x: 13400, y: 200 },
  ] as SecretDef[],
  secretLooks: {
    madonreika: { name: 'Madonreikä', emoji: '🌀', size: 220 },
    kristalli: { name: 'Tähtikristalli', emoji: '💎', size: 80 },
  },

  /** Kapteeni – red alert and route choices. */
  captain: {
    /** PUNAINEN HÄLYTYS: seconds it lasts and seconds before it can be used again. */
    alertSeconds: 10,
    alertCharge: 30,
    /** Seconds the Captain has to choose a route (then the first one is taken). */
    choiceSeconds: 15,
  },

  /** Autopilotti – stations nobody picked do their job slowly. */
  autopilot: {
    /** Throttle button the autopilot uses (0–3). */
    helmThrottle: 2,
    /** Taktiikka's autopilot zaps the nearest thing every this many seconds. */
    zapEvery: 2.5,
    /** Konehuone's autopilot fixes one fault every this many seconds. */
    fixEvery: 10,
    /** Tiede's autopilot scans every this many seconds. */
    scanEvery: 12,
  },

  /** Tähtipäivä – the bridge's silly date, grows during the trip. */
  stardate: { start: 47634.4, perSecond: 0.1 },

  /** Silly lines shown on consoles that have nothing to do yet. */
  sillyLines: [
    'Konsoli 47-B lämpenee… ☕',
    'Avaruuskissa istuu näppäimistöllä 🐈',
    'VIRHE 0x42: kahvinkeitin ylikuumeni',
    'Kalibroidaan vempelettä… 🔧',
    'Laskelmat valmiit: 2 + 2 = kala 🐟',
    'Joku söi viimeisen avaruuskeksin 🍪',
    'Hyperpölynimuri päällä 🌀',
  ],

  /** How many phones the ?testi view opens at first. */
  testPhones: 3,
};
