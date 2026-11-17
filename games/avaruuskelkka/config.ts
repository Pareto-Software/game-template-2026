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
}

export const config = {
  title: 'Avaruuskelkka',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'avaruus' as ThemeName,

  /** Laiva – the crew's spaceship. */
  ship: { name: 'USS Avaruuskelkka', emoji: '🚀', size: 110 },

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
    { name: 'Juustosumu', emoji: '🧀', x: 3200, y: -1300 },
    { name: 'Kivikaista', emoji: '🪨', x: 6400, y: 500 },
    { name: 'Pörröpäiden asema', emoji: '👾', x: 9200, y: -1500 },
    { name: 'Avaruusvalaan laulupaikka', emoji: '🐋', x: 12000, y: 300 },
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

  /** Autopilotti – stations nobody picked do their job slowly. */
  autopilot: {
    /** Throttle button the autopilot uses (0–3). */
    helmThrottle: 2,
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
