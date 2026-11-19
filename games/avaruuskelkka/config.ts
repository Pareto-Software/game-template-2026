// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// A goofy starship-bridge game: every phone is one station of the ship, the
// computer is the ship's main viewscreen. See README.md for which file does what.
// Distances are in pixels of the space map, speeds in pixels per second.

export interface StationDef {
  /** Short id, lowercase a–z only (it is stored in Firebase). Don't change it in a running game. */
  id: string;
  /** Name shown on the phones and the main screen. */
  name: string;
  emoji: string;
  /** One line telling the player what this station does. */
  job: string;
  /** Ohjekortti: a few short lines shown on the phone before the trip (and behind the ❓ button). */
  howTo?: string[];
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
  /** Aliens live here and call when the ship comes close. */
  aliens?: boolean;
  /** The space whale sings here: the crew gets sleepy. */
  song?: boolean;
}

export interface AlienMood {
  /** How the aliens look, and the word Neuvonantaja reads out (e.g. "surullisia" = sad). */
  face: string;
  name: string;
  /** The answer that is right when the aliens feel like this. */
  answer: string;
}

/** Things that need the Captain's permission. */
export type RequestKind = 'warp' | 'madonreika' | 'veto' | 'aseet';

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

  /** Laiva – the crew's spaceship. */
  ship: { name: 'USS Avaruuskelkka', emoji: '🚀', size: 150 },

  /** Konsolien värit – the bridge's console colours (rounded orange/lilac/blue panels). */
  lcars: ['#ff9900', '#cc99cc', '#9999ff', '#ff9966', '#ffcc99', '#cc6666', '#99ccff'],

  /** Asemat – the stations of the ship, in the order they are shown.
   *  A station nobody picks runs on autopilot. */
  stations: [
    {
      id: 'kapteeni', name: 'Kapteeni', emoji: '🧑‍✈️', job: 'Sano "Tehkää niin!" ja tee isot päätökset.',
      howTo: [
        '📨 Muut kysyvät sinulta lupaa: paina ✅ TEHKÄÄ NIIN! tai ❌ EI.',
        '🗺️ Joskus saat valita, kumpaa reittiä lennetään.',
        '🚨 Punainen hälytys: kaikki ovat hetken nopeampia!',
        '🤝 Ohjaus, Taktiikka ja Operaatiot odottavat sinun käskyjäsi.',
      ],
    },
    {
      id: 'ohjaus', name: 'Ohjaus', emoji: '🕹️', job: 'Ohjaa laivaa ja väistele kiviä.',
      howTo: [
        '◀ ▶ Pidä pohjassa: laiva kääntyy. Nuoli näyttää, minne mennään.',
        '🐢 Valitse nopeus. ✨ WARP tarvitsee kapteenin luvan.',
        '🌫️ Sumussa kysy Tieteeltä, mihin päin pitää lentää.',
        '📢 Operaatiot kertoo, mistä kivet tulevat – väistä!',
      ],
    },
    {
      id: 'taktiikka', name: 'Taktiikka', emoji: '🛡️', job: 'Kilvet ylös ja lasereilla poks!',
      howTo: [
        '🔴 Kosketa tutkassa kiveä tai piirakkaa: PIU PIU!',
        '🛡️ Nosta kilvet ennen kuin jokin osuu.',
        '🛸 Möhköttäjää saa ampua vasta kapteenin luvalla.',
        '🎯 Tiede löytää heikot kohdat: laser osuu tuplasti!',
      ],
    },
    {
      id: 'tiede', name: 'Tiede', emoji: '🔭', job: 'Skannaa avaruutta ja löydä salaisuudet.',
      howTo: [
        '📡 Pidä nappia pohjassa: skanneri etsii.',
        '💎 Löydät kristalleja ja madonreiän – kerro Ohjaukselle suunta!',
        '🌫️ Sumussa vain sinä näet tien.',
        '🎯 Skannaa Möhköttäjä: Taktiikka osuu tuplasti.',
      ],
    },
    {
      id: 'operaatiot', name: 'Operaatiot', emoji: '📡', job: 'Seuraa hälytyksiä ja jaa tehtäviä.',
      howTo: [
        '⚠️ Vain sinä näet varoitukset etukäteen!',
        '📢 Lähetä ne Taktiikalle ja Ohjaukselle.',
        '🐈 Kissa istuu jonkun napeilla? Houkuttele se pois 🐟',
        '🧲 Vetosäde nappaa kristallin (kapteenin luvalla).',
      ],
    },
    {
      id: 'viestinta', name: 'Viestintä', emoji: '👽', job: 'Juttele avaruusolioiden kanssa.',
      howTo: [
        '👽 Avaruusoliot soittavat ja puhuvat emojeilla.',
        '💖 Kysy Neuvonantajalta, miltä heistä tuntuu.',
        '✅ Oikea vastaus = uusia ystäviä ja 💎!',
        '🥧 Väärä vastaus = piirakoita…',
      ],
    },
    {
      id: 'konehuone', name: 'Konehuone', emoji: '🔧', job: '"En pysty enempään, kapteeni!"',
      howTo: [
        '◀ ▶ Pidä reaktorin neula vihreällä: ⚡ latautuu.',
        '⚡ Anna virtaa kaverille: hänen asemansa tehostuu!',
        '💥 Kun jokin hajoaa, napauta vikaa, kunnes se on korjattu.',
        '🤝 Kaikki huutavat sinua apuun!',
      ],
    },
    {
      id: 'neuvonantaja', name: 'Neuvonantaja', emoji: '💖', job: 'Pidä miehistön mieli hyvänä.',
      howTo: [
        '💖 Napauta sydäntä, kun se on isoimmillaan.',
        '💖 Sydänmittari täynnä: kannusta kaveria!',
        '😢 Vain sinä näet, miltä avaruusolioista tuntuu – kerro Viestinnälle!',
        '🐋 Pidä miehistö hereillä, kun avaruusvalas laulaa.',
      ],
    },
  ] as StationDef[],

  /** How many players may share one station (when there are more players than stations). */
  playersPerStation: 2,

  /** Player colours: every phone gets the first free one. Lowercase #rrggbb only. */
  colours: ['#ffcc00', '#00d4ff', '#ff5ca8', '#7cff6b', '#ff8a3d', '#b48cff', '#ffffff', '#3dffd2', '#ff4d4d', '#c0c0c0'],

  /** Reitti – the trip from home to the goal planet. */
  route: [
    { name: 'Kotitelakka', emoji: '🛰️', x: 0, y: 0 },
    { name: 'Juustosumu', emoji: '🧀', x: 7040, y: -2860, pirate: true, fog: true },
    {
      name: 'Kivikaista', emoji: '🪨', x: 14080, y: 1100, rocks: true,
      alt: { name: 'Hattarapilvet', emoji: '🍭', x: 11440, y: -8580 },
    },
    { name: 'Pörröpäiden asema', emoji: '👾', x: 20240, y: -3300, aliens: true },
    { name: 'Avaruusvalaan laulupaikka', emoji: '🐋', x: 26400, y: 660, pirate: true, song: true },
    { name: 'Planeetta Kotikolo', emoji: '🪐', x: 33000, y: -1540 },
  ] as Waypoint[],
  /** How close the ship must fly to a place to "arrive" there. */
  arriveDistance: 220,

  /** Ohjaus – how the ship flies. */
  helm: {
    /** Turning speed in degrees per second. */
    turnSpeed: 75,
    /** Speeds for the throttle buttons: SEIS, 1/4, 1/2, TÄYSI impulssi. */
    speeds: [0, 70, 130, 190],
    /** WARP! – very fast for a short time, then it has to charge. */
    warpSpeed: 650,
    warpSeconds: 3,
    warpCharge: 20,
  },

  /** Vaarat – things that fly at the ship. Sizes in pixels, speeds in pixels per second. */
  danger: {
    /** Kivet: a new rock every this many seconds (fieldEvery near a place with rocks: true). */
    rock: { emoji: '🪨', every: 8, fieldEvery: 2.5, speed: 50, size: 95, firstAfter: 12 },
    /** Möhköttäjä: a silly space pirate that circles the ship and throws pies. */
    pirate: { name: 'Möhköttäjä', emoji: '🛸', hp: 4, throwsEvery: 5, leavesAfter: 70, size: 140, circleSpeed: 14,
      /** Seconds after a leg starts before the pirate attacks (Operaatiot is warned warnings.lead seconds before). */
      arrivesAfter: 35 },
    /** Avaruuspiirakka: what the pirate throws. PLÖRTS! */
    pie: { emoji: '🥧', speed: 170, size: 70 },
  },

  /** Taktiikka – lasers and shields. */
  tactical: {
    /** How far the laser reaches (the circle on the radar). */
    range: 700,
    /** Seconds between laser shots. */
    reload: 1.2,
    /** Seconds the shields stay up. */
    shieldSeconds: 7,
    /** Seconds the shields need to charge before they can go up again. */
    shieldCharge: 6,
  },

  /** Viat – a hit without shields breaks one station's console until Konehuone fixes it.
   *  Each fault also slows the ship a bit. What breaks at each station (the effect is in the code): */
  faults: {
    tapsToFix: 3,
    /** Speed lost per fault (0.1 = 10 %). */
    slowEach: 0.1,
    byStation: {
      kapteeni: '🌀 Kapteenin tuoli pyörii',
      ohjaus: '🕹️ Ohjaus jumissa – kääntyy vain vasemmalle',
      taktiikka: '📡 Tutka sumea ja laser hidas',
      tiede: '🔭 Skanneri yskii – kantaa puolet',
      operaatiot: '📢 Varoitukset sekaisin',
      viestinta: '👽 Viesti pätkii',
      konehuone: '🔧 Jakoavain hukassa – korjaus hitaampaa',
      neuvonantaja: '💔 Sydän sekaisin – napautukset eivät auta',
    } as Record<string, string>,
    /** For stations not in the list above (e.g. a new station the kids added). */
    other: '💥 Konsoli kipinöi',
  },

  /** Tehostukset – crew members boost each other's stations for a few seconds. */
  boosts: {
    /** Konehuone's ⚡: seconds in the green zone to charge it, and how long the boost lasts. */
    power: { chargeSeconds: 4, seconds: 12 },
    /** Neuvonantaja's 💖: good heart taps to charge it, how long the boost lasts, mood it adds. */
    cheer: { beats: 4, seconds: 10, morale: 5 },
    /** What a boost does at each station (shown on the boosted phone). */
    texts: {
      kapteeni: 'Punainen hälytys latautuu heti!',
      ohjaus: 'Kääntyy ja lentää nopeammin!',
      taktiikka: 'Laser ampuu kaksi kertaa nopeammin ja kovempaa!',
      tiede: 'Skanneri latautuu heti ja kantaa kaksi kertaa kauemmas!',
      operaatiot: 'Vetosäde kantaa kaksi kertaa kauemmas!',
      viestinta: 'Lisää aikaa – ja yksi väärä vastaus katoaa!',
      konehuone: 'Korjausnapautukset tuplana!',
      neuvonantaja: 'Sydännapautukset tuplana!',
    } as Record<string, string>,
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
    { kind: 'madonreika', x: 10120, y: -990, exit: { x: 18920, y: -2420, target: 3 } },
    { kind: 'kristalli', x: 4180, y: -2420 },
    { kind: 'kristalli', x: 11000, y: -1980 },
    { kind: 'kristalli', x: 17160, y: -5060 },
    { kind: 'kristalli', x: 23320, y: -2420 },
    { kind: 'kristalli', x: 29480, y: 440 },
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
    choiceSeconds: 25,
    /** Requests waiting for "Tehkää niin!": seconds before they expire (then ask again). */
    requestSeconds: 25,
    /** With nobody at Kapteeni, the autopilot approves after this many seconds. */
    autoApprove: 3,
    /** What needs the Captain's permission. */
    requests: {
      warp: '✨ WARP',
      madonreika: '🌀 Hyppy madonreiän läpi',
      veto: '🧲 Vetosäde',
      aseet: '🔴 Lupa ampua Möhköttäjää',
    } as Record<RequestKind, string>,
  },

  /** Mieliala – the crew's mood, 0–100. Low mood slows everything a bit (the game can't be lost). */
  morale: {
    start: 80,
    /** Never lower than this. */
    min: 10,
    /** Lost when something hits the ship. */
    hit: 6,
    /** Lost every second while the space whale sings. */
    songPerSecond: 3,
    /** How far the whale's song reaches. */
    songRadius: 2500,
    /** Gained from a crystal, arriving at a place, and one good heartbeat tap by Neuvonantaja. */
    crystal: 10,
    arrive: 10,
    calm: 4,
    /** Speed lost when the mood is at 0 (0.3 = 30 %). */
    slowAtZero: 0.3,
    /** Seconds between heartbeats in Neuvonantaja's game. */
    beat: 1.1,
  },

  /** Avaruusoliot – the aliens that call Viestintä. */
  aliens: {
    name: 'Pörröpäät',
    emoji: '👾',
    /** Messages per visit near a place with aliens: true. */
    perVisit: 3,
    /** Also a surprise call every this many seconds (0 = never). */
    randomEvery: 90,
    /** Seconds to answer before the aliens give up. */
    answerSeconds: 30,
    /** A friendly answer gives morale and a crystal; a rude one makes them throw this many pies. */
    friendMorale: 15,
    angryPies: 2,
    /** What the aliens say (just for fun – the right answer depends on their mood). */
    messages: ['👋❓', '📡❓', '🍕❓', '🎵🎶', '🛸❓', '🎁❓', '🐈❓'],
    /** Their mood: only Neuvonantaja sees it, so Viestintä has to ask. 3 moods are offered as answers. */
    moods: [
      { face: '😢', name: 'surullisia', answer: '🤗💖' },
      { face: '😴', name: 'unisia', answer: '🤫💤' },
      { face: '🥳', name: 'juhlatuulella', answer: '🎉💃' },
      { face: '😡', name: 'kiukkuisia', answer: '🍪🙏' },
      { face: '🤔', name: 'uteliaita', answer: '👋😄' },
      { face: '🤢', name: 'pahoinvoivia', answer: '🍵🛋️' },
    ] as AlienMood[],
  },

  /** Ennakkovaroitukset – rock showers and pirates are seen early, only on Operaatiot's phone.
   *  Operaatiot forwards them: Taktiikka's shields then go up by themselves, Ohjaus sees where to dodge. */
  warnings: {
    /** A rock shower every this many seconds (the first after firstAfter), with this many rocks. */
    showerEvery: 45,
    firstAfter: 40,
    rocks: 4,
    /** Seconds between the warning and the rocks arriving. */
    lead: 12,
  },

  /** Avaruuskissa – sits on a console and blocks it until Operaatiot lures it away. */
  cat: { emoji: '🐈', every: 70, firstAfter: 60 },

  /** Operaatiot – the tractor beam pulls a found crystal to the ship. */
  ops: { tractorRange: 1000, tractorCharge: 8 },

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
    /** Viestintä's autopilot answers after this many seconds, right this often (0.7 = 70 %). */
    commsSeconds: 5,
    commsRight: 0.7,
    /** Operaatiot's autopilot lures the cat away after this many seconds, and forwards warnings after this many. */
    catSeconds: 10,
    warnSeconds: 2,
    /** Neuvonantaja's autopilot adds this much mood every second. */
    moralePerSecond: 1,
  },

  /** Matkaraportti – the crew report at the end: what each station did.
   *  Every deed belongs to a station; team: true deeds also count as teamwork 🤝. */
  report: {
    deeds: {
      lupa: { station: 'kapteeni', text: '✅ käskyä', team: true },
      paikka: { station: 'ohjaus', text: '🪐 paikkaa' },
      warp: { station: 'ohjaus', text: '✨ warppia' },
      poks: { station: 'taktiikka', text: '💥 poksautettu' },
      torjuttu: { station: 'taktiikka', text: '🛡️ torjuttu' },
      loyto: { station: 'tiede', text: '🔭 löytöä' },
      heikko: { station: 'tiede', text: '🎯 heikkoa kohtaa', team: true },
      varoitus: { station: 'operaatiot', text: '📢 varoitusta', team: true },
      kissa: { station: 'operaatiot', text: '🐈 kissaa pois', team: true },
      ystava: { station: 'viestinta', text: '👽 ystävää', team: true },
      korjaus: { station: 'konehuone', text: '🔧 korjausta', team: true },
      virta: { station: 'konehuone', text: '⚡ virtaa', team: true },
      kannustus: { station: 'neuvonantaja', text: '💖 kannustusta', team: true },
    } as Record<string, { station: string; text: string; team?: boolean }>,
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
