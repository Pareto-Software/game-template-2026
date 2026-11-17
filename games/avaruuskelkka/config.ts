// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// A bridge-crew game: every phone is one station of the ship, the computer is
// the ship's main screen. See README.md for which file does what.

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

export const config = {
  title: 'Avaruuskelkka',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'avaruus' as ThemeName,

  /** Laiva – the crew's spaceship. */
  ship: { emoji: '🚀' },

  /** Asemat – the stations of the ship, in the order they are shown.
   *  A station nobody picks runs on autopilot. */
  stations: [
    { id: 'kapteeni', name: 'Kapteeni', emoji: '🧑‍✈️', job: 'Valitse reitti ja tee isot päätökset.' },
    { id: 'ohjaus', name: 'Ohjaus', emoji: '🕹️', job: 'Ohjaa laivaa ja väistele kiviä.' },
    { id: 'taktiikka', name: 'Taktiikka', emoji: '🛡️', job: 'Suojat ylös ja lasereilla poks!' },
    { id: 'tiede', name: 'Tiede', emoji: '🔭', job: 'Skannaa avaruutta ja löydä salaisuudet.' },
    { id: 'operaatiot', name: 'Operaatiot', emoji: '📡', job: 'Seuraa hälytyksiä ja jaa tehtäviä.' },
    { id: 'viestinta', name: 'Viestintä', emoji: '👽', job: 'Juttele avaruusolioiden kanssa.' },
    { id: 'konehuone', name: 'Konehuone', emoji: '🔧', job: 'Jaa energiaa ja korjaa vikoja.' },
    { id: 'neuvonantaja', name: 'Neuvonantaja', emoji: '💖', job: 'Pidä miehistön mieli hyvänä.' },
  ] as StationDef[],

  /** How many players may share one station (when there are more players than stations). */
  playersPerStation: 2,

  /** Player colours: every phone gets the first free one. Lowercase #rrggbb only. */
  colours: ['#ffcc00', '#00d4ff', '#ff5ca8', '#7cff6b', '#ff8a3d', '#b48cff', '#ffffff', '#3dffd2', '#ff4d4d', '#c0c0c0'],

  /** How many phones the ?testi view opens at first. */
  testPhones: 3,
};
