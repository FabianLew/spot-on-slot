#!/usr/bin/env node
/**
 * Test accounts on a deployed Spot On Slot (production or staging): every tester gets one ARTIST and one VENUE
 * account with a published, filled-in profile (photos, location, rates), a calendar and a listing, so both sides of
 * the app can be tried right away. Bookings and conversations are left for the testers.
 *
 *   cp scripts/testers.example.json scripts/testers.json   # fill in apiUrl and the testers' e-mails
 *   pnpm seed:testers
 * or without a file (PowerShell):
 *   $env:API_URL="https://api.spotonslot.com"; $env:TESTERS="ty@gmail.com,ania@gmail.com"; pnpm seed:testers
 *
 * Accounts are real: their addresses get the verification e-mail. The first run registers them and stops; once every
 * address is verified (each tester clicks the link, or the SQL the script prints is run on the server), the second
 * run fills the profiles. Passwords are generated on the first run and kept in scripts/testers.state.json
 * (gitignored) for later runs; the script prints them at the end. Running it again skips what is already there.
 *
 * Options: --config <file> (default scripts/testers.json). Env: API_URL and TESTERS (comma-separated e-mails) instead
 * of the file, WEB_URL (shown at the end), SEED_PASSWORD (one password for all new accounts, at least 10 characters;
 * otherwise each gets its own).
 */
import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { at, call, configure, fail, find, login, rule, shift, slot, step, upload, warsawToday } from "./seed-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = argument("--config") ?? join(HERE, "testers.json");
const STATE = join(HERE, "testers.state.json");
const SHARED_PASSWORD = process.env.SEED_PASSWORD;

configure({ name: "seed-testers" });

// ---------------------------------------------------------------------------------------------- data (Kraków)

/** Profiles handed out in order: the first tester gets the first artist and the first venue, and so on. */
const ARTISTS = [
  {
    stageName: "Nocny Tramwaj", genres: ["HOUSE", "DISCO", "FUNK"], tags: ["vinyl", "własny sprzęt"],
    bio: "House i disco z płyt, ciepło i tanecznie. Gram w barach i klubach do 300 osób, na mniejsze imprezy przywożę własne nagłośnienie.",
    rateFrom: 700, rateTo: 1400, travelRadiusKm: 60, point: [50.0614, 19.9372],
    skills: { tempo: 7, experience: 8, energy: 8, vinyl: 9, cdj: 7 }, links: { instagram: "https://instagram.com/" },
    colors: ["#ffd400", "#ff261f"], rule: { days: ["FRIDAY", "SATURDAY"], start: "21:00", minutes: 300 },
  },
  {
    stageName: "Echo Kazimierz", genres: ["TECHNO", "MELODIC_TECHNO"], tags: ["peak time", "warehouse"],
    bio: "Melodyjne techno na długie noce. Sety od 2 do 5 godzin, zarówno warm-up, jak i zamknięcie.",
    rateFrom: 1200, rateTo: 2500, travelRadiusKm: 150, point: [50.0510, 19.9460],
    skills: { tempo: 9, experience: 8, energy: 10, cdj: 10, production: 7 }, links: { soundcloud: "https://soundcloud.com/" },
    colors: ["#7c3aed", "#ff261f"], rule: { days: ["SATURDAY"], start: "23:00", minutes: 300 },
  },
  {
    stageName: "Basowa Hala", genres: ["DRUM_AND_BASS", "BREAKBEAT", "DUBSTEP"], tags: ["MC na życzenie"],
    bio: "Drum and bass i breakbeat z Nowej Huty. Szybko, ciężko i do samego rana.",
    rateFrom: 600, rateTo: 1200, travelRadiusKm: 80, point: [50.0720, 20.0370],
    skills: { tempo: 10, experience: 6, energy: 10, cdj: 8 }, links: {},
    colors: ["#16a34a", "#ffd400"], rule: { days: ["FRIDAY"], start: "22:00", minutes: 360 },
  },
  {
    stageName: "Pianino Wieczorem", genres: ["JAZZ", "AMBIENT", "POP"], tags: ["live", "kolacje"],
    bio: "Muzyka na żywo do kolacji i wydarzeń firmowych: pianino solo albo duet z wokalem.",
    rateFrom: 900, rateTo: 1800, travelRadiusKm: 40, point: [50.0830, 19.9100],
    skills: { experience: 9, energy: 4 }, links: { youtube: "https://youtube.com/" },
    colors: ["#f97316", "#0ea5e9"], rule: { days: ["WEDNESDAY", "THURSDAY", "SUNDAY"], start: "19:00", minutes: 180 },
  },
];

const VENUES = [
  {
    name: "Klub Pod Latarnią", type: "CLUB", capacity: 300, genres: ["HOUSE", "TECHNO", "DISCO"], tags: ["dwie sale"],
    description: "Klub na Kazimierzu z dwiema salami. Piątki z house'em, soboty z techno; szukamy DJ-ów na rezydencje i gościnne sety.",
    address: { street: "ul. Miodowa 20", postalCode: "31-055", city: "Kraków", latitude: 50.0517, longitude: 19.9455 },
    colors: ["#ff261f", "#ffd400"], listing: { inDays: 9, start: "22:00", end: "03:00", genres: ["TECHNO", "HOUSE"], priceFrom: 120000, priceTo: 200000,
      description: "Szukamy DJ-a na sobotnią noc w dużej sali, około 250 osób. Sprzęt Pioneer na miejscu." },
  },
  {
    name: "Bar Płyta", type: "BAR", capacity: 90, genres: ["DISCO", "FUNK", "HOUSE"], tags: ["winyle", "koktajle"],
    description: "Bar z płytami na ścianach przy Starym Kleparzu. Disco, funk i house od czwartku do soboty.",
    address: { street: "ul. Długa 30", postalCode: "31-147", city: "Kraków", latitude: 50.0712, longitude: 19.9378 },
    colors: ["#ec4899", "#ffd400"], listing: { inDays: 8, start: "20:00", end: "00:00", genres: ["DISCO", "FUNK"], priceFrom: 50000, priceTo: 90000,
      description: "Piątkowy wieczór z winylami: disco i funk dla około 80 osób." },
  },
  {
    name: "Hala Zabłocie", type: "CONCERT_HALL", capacity: 800, genres: ["TECHNO", "DRUM_AND_BASS", "MELODIC_TECHNO"], tags: ["całonocne imprezy"],
    description: "Postindustrialna hala na Zabłociu. Koncerty i całonocne imprezy elektroniczne.",
    address: { street: "ul. Lipowa 4", postalCode: "30-702", city: "Kraków", latitude: 50.0478, longitude: 19.9612 },
    colors: ["#64748b", "#ff261f"],
  },
  {
    name: "Restauracja Ogród", type: "RESTAURANT", capacity: 140, genres: ["JAZZ", "POP", "OPEN_FORMAT"], tags: ["sala bankietowa", "ogródek"],
    description: "Restauracja z ogrodem i salą bankietową na Salwatorze. Kolacje z muzyką na żywo i imprezy firmowe.",
    address: { street: "ul. Królowej Jadwigi 40", postalCode: "30-209", city: "Kraków", latitude: 50.0540, longitude: 19.9050 },
    colors: ["#16a34a", "#ffd400"], listing: { inDays: 6, start: "19:00", end: "22:00", genres: ["JAZZ", "POP"], priceFrom: 60000, priceTo: 120000,
      description: "Kolacja firmowa na 60 osób, szukamy muzyki na żywo: pianino albo duet." },
  },
];

/** "Jestem wolny" listings of the artists with these indexes, on their first rule date at least this many days ahead. */
const ARTIST_LISTINGS = [
  { artist: 0, inDays: 5, priceFrom: 80000, priceTo: 140000, description: "Wolny wieczór, chętnie zagram house i disco w barze albo klubie." },
  { artist: 2, inDays: 5, priceFrom: 60000, priceTo: 100000, description: "Wolny piątek, drum and bass do rana. Mogę przyjechać z MC." },
];

// ---------------------------------------------------------------------------------------------- main

async function main() {
  const config = readConfig();
  configure({ api: config.apiUrl, name: "seed-testers" });
  await checkBackend(config.apiUrl);
  const state = readState();

  const accounts = config.testers.flatMap((tester, i) => [
    { tester, role: "ARTIST", email: tester.artistEmail ?? plus(tester.email, "artysta"), artist: ARTISTS[i] },
    { tester, role: "VENUE", email: tester.venueEmail ?? plus(tester.email, "klub"), venue: VENUES[i] },
  ]);

  step("Accounts");
  const waiting = [];
  for (const acc of accounts) {
    acc.password = state.passwords[acc.email] ??= SHARED_PASSWORD ?? password();
    saveState(state);
    const signedIn = await login(acc.email, acc.password);
    if (signedIn.token) {
      acc.token = signedIn.token;
      console.log(`  ${acc.email}: ready`);
    } else if (signedIn.code === "IDENTITY_EMAIL_NOT_VERIFIED") {
      waiting.push(acc.email);
      console.log(`  ${acc.email}: waiting for e-mail verification`);
    } else if (state.registered.includes(acc.email)) {
      fail(`Cannot sign in as ${acc.email} (${signedIn.status} ${signedIn.code ?? ""}), although this script registered it. ` +
        "Was the password changed? Set the current one in scripts/testers.state.json, or remove the account.");
    } else {
      await call("POST", "/api/v1/auth/register", undefined, {
        email: acc.email, password: acc.password, role: acc.role, locale: "pl", privacyNoticeAccepted: true, acceptTerms: true,
      });
      state.registered.push(acc.email);
      saveState(state);
      waiting.push(acc.email);
      console.log(`  ${acc.email}: registered, verification e-mail sent`);
    }
  }
  if (waiting.length) {
    printVerificationHelp(waiting);
    return;
  }

  const today = warsawToday();

  step("Artists: locations, photos, profiles, calendars");
  const artists = accounts.filter((acc) => acc.role === "ARTIST");
  for (const [i, acc] of artists.entries()) {
    const a = acc.artist;
    const key = `tester-artist-${i}`;
    const existing = await find("/api/v1/artists/me", acc.token);
    if (existing?.published) {
      acc.slug = existing.slug;
      console.log(`  ${a.stageName} -> /a/${existing.slug} (already there)`);
    } else {
      if (!(await find("/api/v1/locations/me", acc.token))) {
        await call("PUT", "/api/v1/locations/me", acc.token, { latitude: a.point[0], longitude: a.point[1], source: "MANUAL" });
      }
      const avatar = await upload(acc.token, a.colors, 800, 800, key);
      const photos = [await upload(acc.token, a.colors, 1200, 750, `${key}-1`), await upload(acc.token, a.colors.toReversed(), 1200, 750, `${key}-2`)];
      const [firstName, ...rest] = acc.tester.name.split(" ");
      const profile = await call("PUT", "/api/v1/artists/me", acc.token, {
        stageName: a.stageName, firstName, lastName: rest.join(" ") || undefined, bio: a.bio, genres: a.genres, tags: a.tags,
        links: a.links, rateFrom: a.rateFrom * 100, rateTo: a.rateTo * 100, travelRadiusKm: a.travelRadiusKm,
        skills: a.skills, avatarMediaId: avatar, photoMediaIds: photos,
      });
      await call("POST", "/api/v1/artists/me/publish", acc.token);
      acc.slug = profile.slug;
      console.log(`  ${a.stageName} -> /a/${profile.slug}`);
    }
    const calendar = await call("GET", `/api/v1/availability/me?from=${at(today, "00:00")}&to=${at(shift(today, 60), "00:00")}`, acc.token);
    if (calendar.length) continue;
    await rule(acc, a.rule.days, a.rule.start, a.rule.minutes, today);
    await slot(acc, shift(today, 3), "14:00", shift(today, 3), "17:00", "Dzienny set");
    console.log(`  ${a.stageName}: calendar (every ${a.rule.days.join(", ").toLowerCase()} from ${a.rule.start})`);
  }

  step("Venues: photos, profiles");
  const venues = accounts.filter((acc) => acc.role === "VENUE");
  for (const [i, acc] of venues.entries()) {
    const v = acc.venue;
    const key = `tester-venue-${i}`;
    const existing = ((await call("GET", "/api/v1/venues/mine", acc.token)) ?? []).find((m) => m.name === v.name);
    if (existing) {
      if (!existing.published) await call("POST", `/api/v1/venues/${existing.id}/publish`, acc.token);
      acc.venueId = existing.id;
      console.log(`  ${v.name} -> /v/${existing.slug} (already there)`);
      continue;
    }
    const avatar = await upload(acc.token, v.colors, 800, 800, key);
    const photos = [await upload(acc.token, v.colors, 1200, 750, `${key}-1`), await upload(acc.token, v.colors.toReversed(), 1200, 750, `${key}-2`)];
    const saved = await call("POST", "/api/v1/venues", acc.token, {
      name: v.name, type: v.type, description: v.description, capacity: v.capacity, address: v.address,
      genres: v.genres, tags: v.tags, links: { website: "https://spotonslot.com" }, avatarMediaId: avatar, photoMediaIds: photos,
    });
    await call("POST", `/api/v1/venues/${saved.id}/publish`, acc.token);
    acc.venueId = saved.id;
    console.log(`  ${v.name} -> /v/${saved.slug}`);
  }

  step("Listings");
  for (const acc of venues) {
    const l = acc.venue.listing;
    if (!l) continue;
    const own = await call("GET", `/api/v1/venues/${acc.venueId}/listings`, acc.token);
    if ((own.content ?? own).length) {
      console.log(`  ${acc.venue.name}: already there`);
      continue;
    }
    const day = shift(today, l.inDays);
    const endDay = l.end <= l.start ? shift(day, 1) : day;
    await call("POST", `/api/v1/venues/${acc.venueId}/listings`, acc.token, {
      startsAt: at(day, l.start), endsAt: at(endDay, l.end), genres: l.genres, description: l.description, priceFrom: l.priceFrom, priceTo: l.priceTo,
    });
    console.log(`  ${acc.venue.name}: "Szukam artysty" on ${day}`);
  }
  for (const l of ARTIST_LISTINGS) {
    const acc = artists[l.artist];
    if (!acc) continue;
    const own = await call("GET", "/api/v1/listings/mine", acc.token);
    if ((own.content ?? own).length) {
      console.log(`  ${acc.artist.stageName}: already there`);
      continue;
    }
    // The first free time from the weekly rule at least inDays ahead: a listing must lie in free calendar time.
    const free = await call("GET", `/api/v1/availability/me?from=${at(shift(today, l.inDays), "00:00")}&to=${at(shift(today, l.inDays + 14), "00:00")}`, acc.token);
    const entry = free.find((e) => e.status === "FREE");
    if (!entry) {
      console.log(`  ${acc.artist.stageName}: no free time to announce, skipped`);
      continue;
    }
    await call("POST", "/api/v1/listings/mine", acc.token, {
      startsAt: entry.startsAt, endsAt: entry.endsAt, genres: acc.artist.genres.slice(0, 2), description: l.description,
      priceFrom: l.priceFrom, priceTo: l.priceTo, travelRadiusKm: acc.artist.travelRadiusKm,
    });
    console.log(`  ${acc.artist.stageName}: "Jestem wolny" on ${entry.startsAt.slice(0, 10)}`);
  }

  console.log(`\nDone. Sign in at ${config.webUrl ?? "the web app"}. Send each person only their own rows;`);
  console.log("they can set their own password with \"Nie pamiętam hasła\" on the sign-in page.");
  console.table(accounts.map((acc) => ({
    person: acc.tester.name, role: acc.role, email: acc.email, password: acc.password,
    profile: acc.role === "ARTIST" ? acc.artist.stageName : acc.venue.name,
  })));
}

// ---------------------------------------------------------------------------------------------- helpers

function readConfig() {
  if (SHARED_PASSWORD !== undefined && SHARED_PASSWORD.length < 10) {
    fail("SEED_PASSWORD must have at least 10 characters (the backend's rule for passwords).");
  }
  const fromEnv = !argument("--config") && process.env.TESTERS;
  if (!fromEnv && !existsSync(CONFIG)) {
    fail(`No ${CONFIG}. Copy scripts/testers.example.json to scripts/testers.json and fill it in, ` +
      "or set API_URL and TESTERS (comma-separated e-mails).");
  }
  const config = fromEnv
    ? {
      apiUrl: process.env.API_URL, webUrl: process.env.WEB_URL,
      testers: process.env.TESTERS.split(/[,;\s]+/).filter(Boolean).map((email) => ({ name: nameOf(email), email })),
    }
    : JSON.parse(readFileSync(CONFIG, "utf8"));
  const source = fromEnv ? "API_URL/TESTERS" : CONFIG;
  if (!/^https?:\/\//.test(config.apiUrl ?? "")) fail(`${source}: apiUrl must be the backend address, e.g. https://api.spotonslot.com`);
  const testers = config.testers ?? [];
  if (!testers.length || testers.length > ARTISTS.length) fail(`${source}: list 1 to ${ARTISTS.length} testers`);
  for (const t of testers) {
    if (!t.name) fail(`${source}: every tester needs a name`);
    if (!t.email && !(t.artistEmail && t.venueEmail)) fail(`${source}: ${t.name} needs email (or both artistEmail and venueEmail)`);
  }
  const emails = testers.flatMap((t) => [t.artistEmail ?? plus(t.email, "artysta"), t.venueEmail ?? plus(t.email, "klub")]);
  if (new Set(emails.map((e) => e.toLowerCase())).size !== emails.length) fail(`${source}: every account needs its own e-mail address`);
  return config;
}

/** jan.kowalski@gmail.com = "Jan Kowalski": the artist's real name when only an e-mail is given. */
function nameOf(email) {
  return email.split("@")[0].split(/[._+-]+/).filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1)).join(" ") || email;
}

/** jan@gmail.com + "klub" = jan+klub@gmail.com: one inbox, two accounts (Gmail, Outlook and most providers deliver these). */
function plus(email, tag) {
  const sign = email.lastIndexOf("@");
  if (sign < 1) fail(`Not an e-mail address: ${email}`);
  return `${email.slice(0, sign)}+${tag}${email.slice(sign)}`;
}

function readState() {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  return { passwords: state.passwords ?? {}, registered: state.registered ?? [] };
}

function saveState(state) {
  writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
}

/** 16 characters without look-alikes (0/O, 1/l/I), easy to type from a message. */
function password() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

function printVerificationHelp(emails) {
  const list = emails.map((e) => `'${e.toLowerCase().replaceAll("'", "''")}'`).join(", ");
  console.log(`
${emails.length} account(s) wait for e-mail verification. Either each tester clicks the link in the e-mail
("Potwierdź adres"), or verify them all at once on the server (SSH), then run this script again:

  docker exec -i $(docker ps -qf name=^postgres- | head -n1) psql -U spotonslot -d spotonslot -c "UPDATE identity_user SET status = 'ACTIVE', email_verified_at = now() WHERE status = 'PENDING_VERIFICATION' AND email IN (${list})"

(Check first that "docker ps -f name=^postgres-" shows the stack's database.) Unverified accounts are deleted after 7 days.`);
}

async function checkBackend(api) {
  try {
    const response = await fetch(`${api.replace(/\/+$/, "")}/actuator/health`);
    if (!response.ok) throw new Error(String(response.status));
  } catch (error) {
    fail(`The backend is not reachable at ${api} (${error.message}).`);
  }
}

function argument(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

await main();
