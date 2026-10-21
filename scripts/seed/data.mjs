/**
 * Demo profiles shared by the seed scripts: artists and venue accounts in and around Kraków.
 * `email` is the demo address (seed-demo); seed-testers puts testers' own addresses on the same profiles.
 */
export const DEMO_DOMAIN = "demo.spotonslot.pl";
const DOMAIN = DEMO_DOMAIN;

export const ARTISTS = [
  {
    key: "marek", email: `marek@${DOMAIN}`, stageName: "Marek Wave", firstName: "Marek", lastName: "Falkowski",
    genres: ["HOUSE", "DEEP_HOUSE", "TECH_HOUSE"], tags: ["vinyl", "sunset sets", "własny sprzęt"],
    bio: "DJ i producent z Krakowa. Gram house z ciepłym, tanecznym groove'em: od kameralnych barów po kluby na 500 osób. Własny kontroler i nagłośnienie na mniejsze imprezy.",
    rateFrom: 800, rateTo: 1500, travelRadiusKm: 50, point: [50.0614, 19.9372],
    skills: { tempo: 8, experience: 8, energy: 9, vinyl: 7, cdj: 9, production: 6 },
    links: { soundcloud: "https://soundcloud.com/", instagram: "https://instagram.com/" },
    colors: ["#ffd400", "#ff261f"],
  },
  {
    key: "ola", email: `ola@${DOMAIN}`, stageName: "Ola Nova", firstName: "Aleksandra", lastName: "Nowak",
    genres: ["TECHNO", "MELODIC_TECHNO"], tags: ["peak time", "warehouse"],
    bio: "Melodyjne techno na długie noce. Rezydentka krakowskich imprez w magazynach, sety od 3 do 6 godzin.",
    rateFrom: 1200, rateTo: 2500, travelRadiusKm: 150, point: [50.0470, 19.9600],
    skills: { tempo: 9, experience: 9, energy: 10, cdj: 10, production: 8 },
    links: { soundcloud: "https://soundcloud.com/" }, colors: ["#7c3aed", "#ff261f"],
  },
  {
    key: "kuba", email: `kuba@${DOMAIN}`, stageName: "Kuba Bass", firstName: "Jakub", lastName: "Wiśniewski",
    genres: ["DRUM_AND_BASS", "DUBSTEP", "BREAKBEAT"], tags: ["MC na życzenie"],
    bio: "Drum and bass z Nowej Huty. Szybko, ciężko i do samego rana.",
    rateFrom: 600, rateTo: 1200, travelRadiusKm: 80, point: [50.0720, 20.0370],
    skills: { tempo: 10, experience: 6, energy: 10, cdj: 8 }, links: {}, colors: ["#16a34a", "#ffd400"],
  },
  {
    key: "lena", email: `lena@${DOMAIN}`, stageName: "Lena Groove", firstName: "Helena", lastName: "Zając",
    genres: ["DISCO", "FUNK", "HOUSE"], tags: ["nu disco", "brunch"],
    bio: "Disco, funk i house z płyt. Idealnie na piątkowy wieczór w barze i niedzielny brunch.",
    rateFrom: 600, rateTo: 1000, travelRadiusKm: 40, point: [50.0830, 19.9100],
    skills: { tempo: 6, experience: 8, energy: 7, vinyl: 10 }, links: { instagram: "https://instagram.com/" },
    colors: ["#ec4899", "#ffd400"],
  },
  {
    key: "tymon", email: `tymon@${DOMAIN}`, stageName: "Tymon Flow", firstName: "Tymon", lastName: "Kaczmarek",
    genres: ["HIP_HOP", "RNB"], tags: ["open format", "scratch"],
    bio: "Hip-hop i R&B, klasyka i nowości. Scratch na żywo, gram też open format na prywatnych imprezach.",
    rateFrom: 700, rateTo: 1300, travelRadiusKm: 60, point: [50.0300, 19.9300],
    skills: { tempo: 6, experience: 7, energy: 8, vinyl: 8, cdj: 7 }, links: {}, colors: ["#0ea5e9", "#ff261f"],
  },
  {
    key: "zofia", email: `zofia@${DOMAIN}`, stageName: "Zofia Keys", firstName: "Zofia", lastName: "Lewandowska",
    genres: ["JAZZ", "AMBIENT"], tags: ["live", "pianino", "kolacje"],
    bio: "Jazz na żywo: solo na pianinie albo w trio. Kolacje, wernisaże i spokojne wieczory.",
    rateFrom: 900, rateTo: 2000, travelRadiusKm: 30, point: [49.9870, 20.0640],
    skills: { experience: 10, energy: 4 }, links: { youtube: "https://youtube.com/" }, colors: ["#f97316", "#ffd400"],
  },
];

export const VENUE_ACCOUNTS = [
  {
    key: "klub", email: `klub@${DOMAIN}`, manager: `manager@${DOMAIN}`,
    venues: [
      {
        key: "gwiazdy", name: "Pod Gwiazdami", type: "CLUB", capacity: 350,
        description: "Klub na Kazimierzu: dwie sale, piątki z house'em, soboty z techno. Szukamy DJ-ów na stałe rezydencje i gościnne sety.",
        address: { street: "ul. Józefa 12", postalCode: "31-056", city: "Kraków", latitude: 50.0506, longitude: 19.9441 },
        genres: ["HOUSE", "TECHNO", "DISCO"], tags: ["dwie sale", "ogródek"], colors: ["#ff261f", "#ffd400"],
      },
      {
        key: "gwiazdyBar", name: "Gwiazdy Bar", type: "BAR", capacity: 80,
        description: "Mały bar koktajlowy przy klubie Pod Gwiazdami. Spokojniejsze wieczory, winyle i jazz.",
        address: { street: "ul. Józefa 14", postalCode: "31-056", city: "Kraków", latitude: 50.0508, longitude: 19.9447 },
        genres: ["DISCO", "JAZZ", "FUNK"], tags: ["koktajle"], colors: ["#ffd400", "#7c3aed"],
      },
    ],
  },
  {
    key: "forma", email: `forma@${DOMAIN}`,
    venues: [{
      key: "forma", name: "Hala Forma", type: "CONCERT_HALL", capacity: 900,
      description: "Postindustrialna hala na Zabłociu. Koncerty i całonocne imprezy elektroniczne.",
      address: { street: "ul. Przemysłowa 5", postalCode: "30-701", city: "Kraków", latitude: 50.0475, longitude: 19.9620 },
      genres: ["TECHNO", "MELODIC_TECHNO", "HOUSE"], tags: ["nagłośnienie Funktion-One"], colors: ["#64748b", "#ff261f"],
    }],
  },
  {
    key: "winyl", email: `winyl@${DOMAIN}`,
    venues: [{
      key: "winyl", name: "Bar Winyl", type: "BAR", capacity: 120,
      description: "Bar z płytami na ścianach w okolicach Starego Kleparza. Disco, funk i house od czwartku do soboty.",
      address: { street: "ul. Długa 20", postalCode: "31-146", city: "Kraków", latitude: 50.0700, longitude: 19.9380 },
      genres: ["DISCO", "FUNK", "HOUSE"], tags: ["winyle"], colors: ["#ec4899", "#ffd400"],
    }],
  },
  {
    key: "piwnica", email: `piwnica@${DOMAIN}`,
    venues: [{
      key: "piwnica", name: "Piwnica Jazzowa Akord", type: "PUB", capacity: 60,
      description: "Kameralna piwnica przy Rynku. Jazz na żywo od środy do niedzieli.",
      address: { street: "ul. Szewska 8", postalCode: "31-009", city: "Kraków", latitude: 50.0625, longitude: 19.9345 },
      genres: ["JAZZ", "FUNK"], tags: ["koncerty"], colors: ["#f97316", "#0ea5e9"],
    }],
  },
  {
    key: "lipa", email: `lipa@${DOMAIN}`,
    venues: [{
      key: "lipa", name: "Restauracja Pod Lipą", type: "RESTAURANT", capacity: 150,
      description: "Restauracja z salą bankietową w Wieliczce. Kolacje z muzyką na żywo, wesela i imprezy firmowe.",
      address: { street: "ul. Rynek Górny 3", postalCode: "32-020", city: "Wieliczka", latitude: 49.9870, longitude: 20.0650 },
      genres: ["JAZZ", "POP", "OPEN_FORMAT"], tags: ["sala bankietowa"], colors: ["#16a34a", "#ffd400"],
    }],
  },
];
