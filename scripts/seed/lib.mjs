/**
 * Helpers shared by the seed scripts: REST calls against the backend, profile set-up, Warsaw dates and generated
 * placeholder photos. Call {@link configure} first.
 */
import { deflateSync } from "node:zlib";

const ZONE = "Europe/Warsaw";
const config = { api: "http://localhost:8080", password: undefined, name: "seed" };

export function configure(options) {
  Object.assign(config, options);
}

export async function call(method, path, token, body) {
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
export async function find(path, token) {
  const response = await request("GET", path, token);
  if (response.status === 404) return undefined;
  if (!response.ok) fail(`GET ${path} -> ${response.status}\n${await response.text()}`);
  return response.json();
}

/** Sends a request; a 503 (a dependency such as the geocoder is busy) is retried a few times. */
export async function request(method, path, token, body) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(config.api + path, {
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

export async function tryLogin(email) {
  const response = await fetch(`${config.api}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password: config.password }),
  });
  return response.ok ? (await response.json()).accessToken : undefined;
}

export async function upload(token, colors, width, height, seed) {
  const png = poster(width, height, colors, seed);
  const started = await call("POST", "/api/v1/media/uploads", token, { contentType: "image/png", size: png.length });
  const put = await fetch(started.url, { method: "PUT", headers: started.headers, body: png });
  if (!put.ok) fail(`Upload to storage failed: ${put.status} ${await put.text()}`);
  return (await call("POST", `/api/v1/media/uploads/${started.uploadId}/complete`, token)).id;
}

export async function slot(artist, fromDay, fromTime, toDay, toTime, note) {
  await call("POST", "/api/v1/availability/me/slots", artist.token, { startsAt: at(fromDay, fromTime), endsAt: at(toDay, toTime), note });
}

export async function rule(artist, days, startTime, durationMinutes, validFrom) {
  await call("POST", "/api/v1/availability/me/rules", artist.token, { days, startTime, durationMinutes, validFrom });
}

// ---------------------------------------------------------------------------------------------- profiles

/** Location, photos and a published artist profile for {@code a} (an entry of ARTISTS); skips a published one. */
export async function artistProfile(token, a) {
  const existing = await find("/api/v1/artists/me", token);
  if (existing?.published) return { slug: existing.slug, created: false };
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
  return { slug: profile.slug, created: true };
}

/** Photos and a published venue for {@code v} (a venue of VENUE_ACCOUNTS); reuses one with the same name. */
export async function venueProfile(token, v) {
  const mine = (await call("GET", "/api/v1/venues/mine", token)) ?? [];
  const existing = mine.find((m) => m.name === v.name);
  if (existing) {
    if (!existing.published) await call("POST", `/api/v1/venues/${existing.id}/publish`, token);
    return { id: existing.id, slug: existing.slug, created: false };
  }
  const avatar = await upload(token, v.colors, 800, 800, v.key);
  const photos = [await upload(token, v.colors, 1200, 750, `${v.key}-1`), await upload(token, v.colors.toReversed(), 1200, 750, `${v.key}-2`)];
  const saved = await call("POST", "/api/v1/venues", token, {
    name: v.name, type: v.type, description: v.description, capacity: v.capacity, address: v.address,
    genres: v.genres, tags: v.tags, links: { website: "https://example.com" }, avatarMediaId: avatar, photoMediaIds: photos,
  });
  await call("POST", `/api/v1/venues/${saved.id}/publish`, token);
  return { id: saved.id, slug: saved.slug, created: true };
}

// ---------------------------------------------------------------------------------------------- dates (Warsaw)

/** Today in Warsaw and the demo Friday: the first Friday at least two days ahead, so the Thursday before it is still ahead too. */
export function demoDays() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
  const fri = nextWeekday(today, 5, 2);
  const add = (days) => shift(fri, days);
  return { today, fri, thu: shift(fri, -1), sat: shift(fri, 1), add };
}

export function shift(ymd, days) {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The first {@code weekday} (0 = Sunday) at least {@code minDays} after {@code ymd}. */
export function nextWeekday(ymd, weekday, minDays) {
  let day = shift(ymd, minDays);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== weekday) day = shift(day, 1);
  return day;
}

/** Warsaw wall-clock time on a day as an ISO instant. */
export function at(ymd, hhmm) {
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
export function poster(width, height, [first, second], seed) {
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

export function step(name) {
  console.log(`\n== ${name}`);
}

export function fail(message) {
  console.error(`\n${config.name}: ${message}`);
  process.exit(1);
}

