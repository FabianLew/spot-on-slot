#!/usr/bin/env node
/**
 * Fills a local Spot On Slot with demo data (Kraków): 6 artists, 6 venues, calendars, listings, bookings,
 * conversations and the notifications they trigger. Everything goes through the public REST API, so the data
 * is exactly what the app would store, and e-mail links (verification, venue invitation) are read from Mailpit.
 *
 * Needs the backend (http://localhost:8080) with docker compose services running:
 *   pnpm seed:demo
 * Running it again continues where a failed run stopped and skips what is already there.
 * Start over: stop the backend, `docker compose down -v`, start it again and re-run.
 *
 * Env: API_URL (default http://localhost:8080), MAILPIT_URL (default http://localhost:8025),
 * DEMO_PASSWORD (default demo-spot-123). Times are relative to today (Europe/Warsaw), so seed close to the demo.
 */
import { deflateSync } from "node:zlib";

const API = process.env.API_URL ?? "http://localhost:8080";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-spot-123";
const DOMAIN = "demo.spotonslot.pl";
const ZONE = "Europe/Warsaw";

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API) && !process.argv.includes("--allow-remote")) {
  fail(`API_URL ${API} is not local. Demo data belongs on a local backend (pass --allow-remote to override).`);
}

// ---------------------------------------------------------------------------------------------- data

const ARTISTS = [
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

const VENUE_ACCOUNTS = [
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

// ---------------------------------------------------------------------------------------------- main

async function main() {
  await checkServices();

  const day = demoDays();
  console.log(`Demo Friday: ${day.fri} (seed close to the demo; times are relative to today)`);

  step("Artists: accounts, locations, photos, profiles");
  const artist = {};
  for (const a of ARTISTS) {
    const token = await account(a.email, "ARTIST");
    const existing = await find("/api/v1/artists/me", token);
    if (existing?.published) {
      artist[a.key] = { token, slug: existing.slug };
      console.log(`  ${a.stageName} -> /a/${existing.slug} (already there)`);
      continue;
    }
    if (!(await find("/api/v1/locations/me", token))) {
      await call("PUT", "/api/v1/locations/me", token, { latitude: a.point[0], longitude: a.point[1], source: "MANUAL" });
    }
    const avatar = await upload(token, a.colors, 800, 800, a.key);
    const photos = [await upload(token, a.colors, 1200, 750, `${a.key}-1`), await upload(token, a.colors.toReversed(), 1200, 750, `${a.key}-2`)];
    const profile = await call("PUT", "/api/v1/artists/me", token, {
      stageName: a.stageName, firstName: a.firstName, lastName: a.lastName, bio: a.bio, genres: a.genres, tags: a.tags,
      links: a.links, rateFrom: a.rateFrom * 100, rateTo: a.rateTo * 100, travelRadiusKm: a.travelRadiusKm,
      skills: a.skills, avatarMediaId: avatar, photoMediaIds: photos,
    });
    await call("POST", "/api/v1/artists/me/publish", token);
    artist[a.key] = { token, slug: profile.slug };
    console.log(`  ${a.stageName} -> /a/${profile.slug}`);
  }

  step("Venues: accounts, photos, profiles, team");
  const venue = {};
  const owner = {};
  for (const owned of VENUE_ACCOUNTS) {
    const token = await account(owned.email, "VENUE");
    owner[owned.key] = token;
    const mine = (await call("GET", "/api/v1/venues/mine", token)) ?? [];
    for (const v of owned.venues) {
      const existing = mine.find((m) => m.name === v.name);
      if (existing) {
        if (!existing.published) await call("POST", `/api/v1/venues/${existing.id}/publish`, token);
        venue[v.key] = { id: existing.id, token, slug: existing.slug };
        console.log(`  ${v.name} -> /v/${existing.slug} (already there)`);
        continue;
      }
      const avatar = await upload(token, v.colors, 800, 800, v.key);
      const photos = [await upload(token, v.colors, 1200, 750, `${v.key}-1`), await upload(token, v.colors.toReversed(), 1200, 750, `${v.key}-2`)];
      const saved = await call("POST", "/api/v1/venues", token, {
        name: v.name, type: v.type, description: v.description, capacity: v.capacity, address: v.address,
        genres: v.genres, tags: v.tags, links: { website: "https://example.com" }, avatarMediaId: avatar, photoMediaIds: photos,
      });
      await call("POST", `/api/v1/venues/${saved.id}/publish`, token);
      venue[v.key] = { id: saved.id, token, slug: saved.slug };
      console.log(`  ${v.name} -> /v/${saved.slug}`);
    }
    const first = venue[owned.venues[0].key];
    const team = owned.manager && (await call("GET", `/api/v1/venues/${first.id}/team`, token));
    if (owned.manager && !team.members.some((member) => member.email === owned.manager)) {
      const managerToken = await account(owned.manager, "VENUE");
      await call("POST", `/api/v1/venues/${first.id}/team/invitations`, token, { email: owned.manager, role: "MANAGER" });
      const inviteToken = await linkToken(owned.manager, "/venue-invitation?token=");
      await call("POST", "/api/v1/venues/invitations/accept", managerToken, { token: inviteToken });
      console.log(`  ${owned.manager} joined ${owned.venues[0].name} as manager`);
    }
  }

  const { marek, ola, kuba, lena, tymon, zofia } = artist;
  step("Calendars");
  if ((await call("GET", `/api/v1/availability/me?from=${new Date().toISOString()}&to=${at(day.add(20), "00:00")}`, marek.token)).length) {
    console.log("  already there");
  } else {
    // Marek: the demo Friday stays free and unannounced (announced live). Saturdays stay empty: the demo adds a weekly rule.
    await slot(marek, day.thu, "20:00", day.thu, "23:59", "Bar, spokojniejszy set");
    await slot(marek, day.fri, "21:00", day.sat, "02:00");
    await slot(marek, day.add(5), "19:00", day.add(5), "23:00");
    await slot(marek, day.add(7), "21:00", day.add(8), "02:00");
    await slot(marek, day.add(14), "21:00", day.add(15), "03:00");
    await rule(ola, ["FRIDAY", "SATURDAY"], "22:00", 360, day.today);
    await slot(kuba, day.fri, "22:00", day.sat, "03:00");
    await slot(kuba, day.add(7), "22:00", day.add(8), "04:00");
    await slot(lena, day.fri, "21:00", day.sat, "02:00");
    await slot(lena, day.add(2), "11:00", day.add(2), "15:00", "Brunch");
    await slot(lena, day.add(7), "20:00", day.add(8), "00:00");
    await rule(tymon, ["THURSDAY", "SATURDAY"], "21:00", 300, day.today);
    await rule(zofia, ["WEDNESDAY", "FRIDAY", "SUNDAY"], "19:00", 180, day.today);
  }

  step("Listings");
  if ((await call("GET", "/api/v1/listings/mine", ola.token)).content?.length) {
    console.log("  already there");
  } else {
    await call("POST", "/api/v1/listings/mine", ola.token, {
      startsAt: at(day.sat, "22:00"), endsAt: at(day.add(2), "03:00"), genres: ["TECHNO", "MELODIC_TECHNO"],
      description: "Wolna sobota, chętnie zagram peak time w klubie albo na imprezie w hali.", priceFrom: 150000, priceTo: 250000, travelRadiusKm: 100,
    });
    await call("POST", "/api/v1/listings/mine", kuba.token, {
      startsAt: at(day.add(7), "22:00"), endsAt: at(day.add(8), "04:00"), genres: ["DRUM_AND_BASS"],
      description: "Wolny piątek, drum and bass do rana. Mogę przyjechać z MC.", priceFrom: 60000, priceTo: 100000, travelRadiusKm: 80,
    });
    await call("POST", `/api/v1/venues/${venue.forma.id}/listings`, venue.forma.token, {
      startsAt: at(day.sat, "21:00"), endsAt: at(day.add(2), "03:00"), genres: ["TECHNO", "MELODIC_TECHNO"],
      description: "Szukamy headlinera techno na sobotnią imprezę w hali, około 800 osób. Nagłośnienie i oświetlenie na miejscu.", priceFrom: 200000, priceTo: 350000,
    });
    await call("POST", `/api/v1/venues/${venue.winyl.id}/listings`, venue.winyl.token, {
      startsAt: at(day.add(7), "20:00"), endsAt: at(day.add(8), "00:00"), genres: ["DISCO", "FUNK"],
      description: "Piątkowy wieczór z winylami: disco i funk dla około 100 osób.", priceFrom: 50000, priceTo: 90000,
    });
    await call("POST", `/api/v1/venues/${venue.gwiazdyBar.id}/listings`, venue.gwiazdyBar.token, {
      startsAt: at(day.add(9), "19:00"), endsAt: at(day.add(9), "22:00"), genres: ["JAZZ"],
      description: "Niedzielny jazz w barze, solo albo duet.", priceFrom: 60000, priceTo: 120000,
    });
  }

  step("Bookings");
  if ((await call("GET", "/api/v1/bookings", marek.token)).content?.length) {
    console.log("  already there");
  } else {
    // Hala Forma books Marek in two weeks after his counteroffer: his "next gig" after the demo Friday.
    const forma = await call("POST", "/api/v1/bookings", venue.forma.token, {
      venueId: venue.forma.id, artistSlug: marek.slug, startsAt: at(day.add(14), "22:00"), endsAt: at(day.add(15), "03:00"),
      amount: 120000, message: "Cześć! Zagrasz u nas otwarcie nocy przed headlinerem?",
    });
    const formaCounter = await call("POST", `/api/v1/bookings/${forma.id}/counter`, marek.token, {
      startsAt: at(day.add(14), "22:00"), endsAt: at(day.add(15), "03:00"), amount: 150000,
      message: "Chętnie, przy pięciu godzinach wychodzi 1500 zł.",
    });
    await call("POST", `/api/v1/bookings/${forma.id}/accept`, venue.forma.token, { revision: formaCounter.revision });
    // Bar Winyl asks Marek about Thursday: waits for him ("Czeka na mnie").
    await call("POST", "/api/v1/bookings", venue.winyl.token, {
      venueId: venue.winyl.id, artistSlug: marek.slug, startsAt: at(day.thu, "20:00"), endsAt: at(day.thu, "23:59"),
      amount: 70000, message: "Spokojny czwartkowy set, deep house do koktajli?",
    });
    // Pod Gwiazdami already booked Ola Nova for next Saturday (a rule date becomes booked).
    const olaBooking = await call("POST", "/api/v1/bookings", venue.gwiazdy.token, {
      venueId: venue.gwiazdy.id, artistSlug: ola.slug, startsAt: at(day.add(8), "23:00"), endsAt: at(day.add(9), "04:00"),
      amount: 200000, message: "Sobota w dużej sali, zamknięcie nocy.",
    });
    await call("POST", `/api/v1/bookings/${olaBooking.id}/accept`, ola.token, { revision: olaBooking.revision });
    // Restauracja Pod Lipą asked Zofia Keys, she declined: something in the history.
    const lipa = await call("POST", "/api/v1/bookings", venue.lipa.token, {
      venueId: venue.lipa.id, artistSlug: zofia.slug, startsAt: at(nextWeekday(day.today, 3, 1), "19:00"), endsAt: at(nextWeekday(day.today, 3, 1), "22:00"),
      amount: 80000, message: "Kolacja firmowa na 40 osób.",
    });
    await call("POST", `/api/v1/bookings/${lipa.id}/decline`, zofia.token, { reason: "Ten termin mam już zajęty prywatnie." });
    // Lena applies to Bar Winyl's "Szukam artysty": waits for the venue.
    const winylListings = await call("GET", `/api/v1/venues/${venue.winyl.id}/listings`, venue.winyl.token);
    const winylListing = (winylListings.content ?? winylListings)[0];
    await call("POST", "/api/v1/bookings", lena.token, { listingId: winylListing.id, amount: 80000, message: "Mam dwie skrzynki disco, chętnie zagram!" });
  }

  step("Conversations");
  if ((await call("GET", "/api/v1/conversations", tymon.token)).content?.length) {
    console.log("  already there");
  } else {
    await call("POST", "/api/v1/conversations", venue.forma.token, {
      venueId: venue.forma.id, artistSlug: marek.slug, body: "Hej Marek, myślimy o stałej rezydencji raz w miesiącu. Pogadamy po weekendzie?",
    });
    const lenaChat = await call("POST", "/api/v1/conversations", venue.gwiazdy.token, {
      venueId: venue.gwiazdy.id, artistSlug: lena.slug, body: "Cześć Lena, grasz też w niedziele w ciągu dnia? Myślimy o brunchu w ogródku.",
    });
    await call("POST", `/api/v1/conversations/${lenaChat.id}/messages`, lena.token, { body: "Cześć! Tak, brunch to mój ulubiony format. Podeślę propozycję setu." });
    await call("POST", "/api/v1/conversations", tymon.token, {
      venueSlug: venue.gwiazdy.slug, body: "Dzień dobry, gram hip-hop i R&B, czy macie wolne czwartki w małej sali?",
    });
  }

  console.log("\nDone. Sign in at http://localhost:3000 with password", JSON.stringify(PASSWORD));
  console.table([
    ...ARTISTS.map((a) => ({ account: a.email, role: "ARTIST", what: a.stageName })),
    ...VENUE_ACCOUNTS.flatMap((acc) => [
      { account: acc.email, role: "VENUE (owner)", what: acc.venues.map((v) => v.name).join(", ") },
      ...(acc.manager ? [{ account: acc.manager, role: "VENUE (manager)", what: acc.venues[0].name }] : []),
    ]),
  ]);
  console.log(`Demo Friday (free for Marek Wave and Lena Groove): ${day.fri} 21:00-02:00`);
}

// ---------------------------------------------------------------------------------------------- API helpers

async function call(method, path, token, body) {
  const response = await request(method, path, token, body);
  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 503 && path.startsWith("/api/v1/locations")
      ? "\nThe backend could not reach the Photon geocoder (photon.komoot.io in dev; it is slow or down at times). " +
        "Run this again in a minute: it continues where it stopped. If it keeps failing, run `pnpm geocoder:local` " +
        "and restart the backend with LOCATION_GEOCODER_URL=http://localhost:2322 (an offline stand-in)."
      : "";
    fail(`${method} ${path} -> ${response.status}\n${text}${hint}`);
  }
  return text ? JSON.parse(text) : undefined;
}

/** GET that answers undefined for 404 (nothing there yet). */
async function find(path, token) {
  const response = await request("GET", path, token);
  if (response.status === 404) return undefined;
  if (!response.ok) fail(`GET ${path} -> ${response.status}\n${await response.text()}`);
  return response.json();
}

/** Sends a request; a 503 (a dependency such as the geocoder is busy) is retried a few times. */
async function request(method, path, token, body) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(API + path, {
      method,
      headers: {
        Accept: "application/json",
        "Accept-Language": "pl",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status !== 503 || attempt === 6) return response;
    console.log(`  ${method} ${path} -> 503, retrying (${attempt}/5)`);
    await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
  }
}

async function tryLogin(email) {
  const response = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return response.ok ? (await response.json()).accessToken : undefined;
}

/** Signs in, or registers, confirms the e-mail and signs in. */
async function account(email, role) {
  const existing = await tryLogin(email);
  if (existing) return existing;
  await call("POST", "/api/v1/auth/register", undefined, {
    email, password: PASSWORD, role, locale: "pl", privacyNoticeAccepted: true, acceptTerms: true,
  });
  const token = await linkToken(email, "/verify-email?token=");
  await call("POST", "/api/v1/auth/verify-email", undefined, { token });
  const access = await tryLogin(email);
  if (!access) fail(`Cannot sign in as ${email} after verification`);
  return access;
}

/** Waits for the newest e-mail to {@code email} containing {@code marker} and returns the token after it. */
async function linkToken(email, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}([A-Za-z0-9_%.~-]+)`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=20`);
    if (search.ok) {
      for (const message of (await search.json()).messages ?? []) {
        const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
        const match = `${full.Text ?? ""}\n${full.HTML ?? ""}`.match(pattern);
        if (match) return decodeURIComponent(match[1]);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`No e-mail with ${marker} for ${email} in Mailpit (${MAILPIT}). Is Mailpit running and the backend sending to it?`);
}

async function upload(token, colors, width, height, seed) {
  const png = poster(width, height, colors, seed);
  const started = await call("POST", "/api/v1/media/uploads", token, { contentType: "image/png", size: png.length });
  const put = await fetch(started.url, { method: "PUT", headers: started.headers, body: png });
  if (!put.ok) fail(`Upload to storage failed: ${put.status} ${await put.text()}`);
  return (await call("POST", `/api/v1/media/uploads/${started.uploadId}/complete`, token)).id;
}

async function slot(artist, fromDay, fromTime, toDay, toTime, note) {
  await call("POST", "/api/v1/availability/me/slots", artist.token, { startsAt: at(fromDay, fromTime), endsAt: at(toDay, toTime), note });
}

async function rule(artist, days, startTime, durationMinutes, validFrom) {
  await call("POST", "/api/v1/availability/me/rules", artist.token, { days, startTime, durationMinutes, validFrom });
}

async function checkServices() {
  for (const [name, url] of [["backend", `${API}/actuator/health`], ["Mailpit", `${MAILPIT}/api/v1/info`]]) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
    } catch (error) {
      fail(`${name} is not reachable at ${url} (${error.message}). Start docker compose and the backend first.`);
    }
  }
}

// ---------------------------------------------------------------------------------------------- dates (Warsaw)

/** Today in Warsaw and the demo Friday: the first Friday at least two days ahead, so the Thursday before it is still ahead too. */
function demoDays() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
  const fri = nextWeekday(today, 5, 2);
  const add = (days) => shift(fri, days);
  return { today, fri, thu: shift(fri, -1), sat: shift(fri, 1), add };
}

function shift(ymd, days) {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The first {@code weekday} (0 = Sunday) at least {@code minDays} after {@code ymd}. */
function nextWeekday(ymd, weekday, minDays) {
  let day = shift(ymd, minDays);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== weekday) day = shift(day, 1);
  return day;
}

/** Warsaw wall-clock time on a day as an ISO instant. */
function at(ymd, hhmm) {
  const naive = Date.parse(`${ymd}T${hhmm}:00Z`);
  let instant = naive - offset(naive);
  instant = naive - offset(instant);
  return new Date(instant).toISOString();
}

function offset(instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - Math.floor(instant / 60000) * 60000;
}

// ---------------------------------------------------------------------------------------------- placeholder images

/** A pixel-art "stage" poster in two brand colours: blocky gradient, spotlights and lit pixels. Deterministic per seed. */
function poster(width, height, [first, second], seed) {
  const random = rng(seed);
  const a = rgb(first);
  const b = rgb(second);
  const block = 20;
  const lights = Array.from({ length: 3 }, () => ({ x: random() * width, y: random() * height * 0.6, r: (0.15 + random() * 0.2) * width }));
  const lit = new Map(Array.from({ length: 160 }, () => [
    `${Math.floor(random() * width / block)},${Math.floor(random() * height / block)}`, random() < 0.5 ? a : b,
  ]));
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    const by = Math.floor(y / block);
    for (let x = 0; x < width; x++) {
      const bx = Math.floor(x / block);
      const cx = bx * block + block / 2;
      const cy = by * block + block / 2;
      const t = Math.round((cy / height) * 6) / 6;
      let color = mix([12, 12, 12], b, 0.35 * t);
      for (const light of lights) {
        const d = Math.hypot(cx - light.x, cy - light.y) / light.r;
        if (d < 1) color = mix(color, a, Math.round((1 - d) * 4) / 5);
      }
      color = lit.get(`${bx},${by}`) ?? color;
      if (x % block === 0 || y % block === 0) color = mix(color, [0, 0, 0], 0.3);
      raw.set(color, row + 1 + x * 3);
    }
  }
  return png(width, height, raw);
}

function png(width, height, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function mix(from, to, amount) {
  return from.map((value, i) => Math.round(value + (to[i] - value) * amount));
}

function rng(seed) {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------- output

function step(name) {
  console.log(`\n== ${name}`);
}

function fail(message) {
  console.error(`\nseed-demo: ${message}`);
  process.exit(1);
}

await main();
