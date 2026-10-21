#!/usr/bin/env node
/**
 * Sets up test accounts on a deployed Spot On Slot (production included): for every tester one ARTIST and one
 * VENUE account with a published profile, photos, a calendar and a few listings, in and around Kraków. Bookings
 * and conversations are left for the testers to make. Everything goes through the public REST API.
 *
 *   TESTERS="ty@gmail.com,ania@gmail.com" SEED_PASSWORD="..." API_URL=https://api.spotonslot.com pnpm seed:testers
 *
 * Accounts use plus addresses of the testers' own inboxes (ania+artysta@gmail.com, ania+klub@gmail.com; Gmail,
 * Outlook and iCloud deliver them to ania@gmail.com), so activation links and notifications reach real people.
 * The first run registers the accounts and stops: each one has to be activated, by its link or all at once with
 * the SQL the script prints. Run it again afterwards and it fills the profiles. Re-runs skip what is already there.
 *
 * Env: API_URL (required), TESTERS (comma-separated e-mails, at most 5), SEED_PASSWORD (required, shared by all
 * accounts; give it to the testers yourself), WEB_URL (for the printed links, default https://app.spotonslot.com).
 */
import { ARTISTS, VENUE_ACCOUNTS } from "./seed/data.mjs";
import { artistProfile, at, call, configure, demoDays, fail, rule, slot, step, tryLogin, venueProfile } from "./seed/lib.mjs";

const API = process.env.API_URL;
const PASSWORD = process.env.SEED_PASSWORD;
const WEB = process.env.WEB_URL ?? "https://app.spotonslot.com";
const TESTERS = (process.env.TESTERS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
configure({ api: API, password: PASSWORD, name: "seed-testers" });

if (!API) fail("Set API_URL, e.g. https://api.spotonslot.com");
if (!PASSWORD) fail("Set SEED_PASSWORD (the password of every test account)");
if (!TESTERS.length) fail('Set TESTERS, e.g. TESTERS="ty@gmail.com,ania@gmail.com"');
if (TESTERS.length > Math.min(ARTISTS.length, VENUE_ACCOUNTS.length)) {
  fail(`At most ${Math.min(ARTISTS.length, VENUE_ACCOUNTS.length)} testers (one prepared artist and venue each)`);
}
for (const email of TESTERS) if (!/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`Not a plain e-mail address: ${email}`);

/** One artist and one venue per tester, on plus addresses of the tester's inbox. */
const accounts = TESTERS.map((email, i) => {
  const [local, domain] = email.split("@");
  return {
    tester: email,
    artist: { ...ARTISTS[i], email: `${local}+artysta@${domain}` },
    venue: { email: `${local}+klub@${domain}`, profile: VENUE_ACCOUNTS[i].venues[0] },
  };
});

async function main() {
  await checkBackend();

  step("Accounts");
  const tokens = {};
  const pending = [];
  for (const { artist, venue } of accounts) {
    for (const [email, role] of [[artist.email, "ARTIST"], [venue.email, "VENUE"]]) {
      tokens[email] = await tryLogin(email);
      if (tokens[email]) {
        console.log(`  ${email} (${role}) ready`);
        continue;
      }
      // Answers the same whether or not the address already has an account, so this also covers re-runs.
      await call("POST", "/api/v1/auth/register", undefined, {
        email, password: PASSWORD, role, locale: "pl", privacyNoticeAccepted: true, acceptTerms: true,
      });
      pending.push(email);
      console.log(`  ${email} (${role}) registered, waiting for activation`);
    }
  }
  if (pending.length) return explainActivation(pending);

  const day = demoDays();
  step("Artists: locations, photos, profiles");
  const artists = {};
  for (const { artist } of accounts) {
    const token = tokens[artist.email];
    const { slug, created } = await artistProfile(token, artist);
    artists[artist.key] = { token, slug };
    console.log(`  ${artist.stageName} -> ${WEB}/a/${slug}${created ? "" : " (already there)"}`);
  }

  step("Venues: photos, profiles");
  const venues = {};
  for (const { venue } of accounts) {
    const token = tokens[venue.email];
    const { id, slug, created } = await venueProfile(token, venue.profile);
    venues[venue.profile.key] = { id, token, slug };
    console.log(`  ${venue.profile.name} -> ${WEB}/v/${slug}${created ? "" : " (already there)"}`);
  }

  step("Calendars");
  const { marek, ola, kuba, lena, tymon } = artists;
  const first = Object.values(artists)[0];
  const horizon = `from=${new Date().toISOString()}&to=${at(day.add(20), "00:00")}`;
  if ((await call("GET", `/api/v1/availability/me?${horizon}`, first.token)).length) {
    console.log("  already there");
  } else {
    if (marek) {
      await slot(marek, day.thu, "20:00", day.thu, "23:59", "Bar, spokojniejszy set");
      await slot(marek, day.fri, "21:00", day.sat, "02:00");
      await slot(marek, day.add(7), "21:00", day.add(8), "02:00");
      await rule(marek, ["SATURDAY"], "21:00", 300, day.add(14));
    }
    if (ola) await rule(ola, ["FRIDAY", "SATURDAY"], "22:00", 360, day.today);
    if (kuba) {
      await slot(kuba, day.fri, "22:00", day.sat, "03:00");
      await slot(kuba, day.add(7), "22:00", day.add(8), "04:00");
    }
    if (lena) {
      await slot(lena, day.fri, "21:00", day.sat, "02:00");
      await slot(lena, day.add(2), "11:00", day.add(2), "15:00", "Brunch");
      await rule(lena, ["THURSDAY"], "20:00", 240, day.today);
    }
    if (tymon) await rule(tymon, ["THURSDAY", "SATURDAY"], "21:00", 300, day.today);
    console.log("  free time for the next weeks added");
  }

  step("Listings");
  if ((await call("GET", "/api/v1/listings/mine", first.token)).content?.length) {
    console.log("  already there");
  } else {
    if (marek) {
      await call("POST", "/api/v1/listings/mine", marek.token, {
        startsAt: at(day.fri, "21:00"), endsAt: at(day.sat, "02:00"), genres: ["HOUSE", "DEEP_HOUSE"],
        description: "Wolny piątek, house do tańca w klubie albo barze. Mam własny kontroler.", priceFrom: 80000, priceTo: 150000, travelRadiusKm: 50,
      });
    }
    if (ola) {
      await call("POST", "/api/v1/listings/mine", ola.token, {
        startsAt: at(day.sat, "22:00"), endsAt: at(day.add(2), "03:00"), genres: ["TECHNO", "MELODIC_TECHNO"],
        description: "Wolna sobota, chętnie zagram peak time w klubie albo na imprezie w hali.", priceFrom: 150000, priceTo: 250000, travelRadiusKm: 100,
      });
    }
    const { gwiazdy, forma, winyl, piwnica } = venues;
    if (gwiazdy) {
      await call("POST", `/api/v1/venues/${gwiazdy.id}/listings`, gwiazdy.token, {
        startsAt: at(day.add(7), "21:00"), endsAt: at(day.add(8), "02:00"), genres: ["HOUSE", "DISCO"],
        description: "Piątek w dużej sali, około 300 osób. Szukamy DJ-a na cały wieczór.", priceFrom: 80000, priceTo: 150000,
      });
    }
    if (forma) {
      await call("POST", `/api/v1/venues/${forma.id}/listings`, forma.token, {
        startsAt: at(day.sat, "21:00"), endsAt: at(day.add(2), "03:00"), genres: ["TECHNO", "MELODIC_TECHNO"],
        description: "Szukamy headlinera techno na sobotnią imprezę w hali, około 800 osób. Nagłośnienie i oświetlenie na miejscu.", priceFrom: 200000, priceTo: 350000,
      });
    }
    if (winyl) {
      await call("POST", `/api/v1/venues/${winyl.id}/listings`, winyl.token, {
        startsAt: at(day.add(7), "20:00"), endsAt: at(day.add(8), "00:00"), genres: ["DISCO", "FUNK"],
        description: "Piątkowy wieczór z winylami: disco i funk dla około 100 osób.", priceFrom: 50000, priceTo: 90000,
      });
    }
    if (piwnica) {
      await call("POST", `/api/v1/venues/${piwnica.id}/listings`, piwnica.token, {
        startsAt: at(day.add(2), "19:00"), endsAt: at(day.add(2), "22:00"), genres: ["JAZZ"],
        description: "Niedzielny jazz w piwnicy, solo albo duet.", priceFrom: 60000, priceTo: 120000,
      });
    }
    console.log("  listings posted");
  }

  console.log(`\nDone. Sign in at ${WEB} with the SEED_PASSWORD.`);
  console.table(accounts.flatMap(({ tester, artist, venue }) => [
    { tester, account: artist.email, role: "ARTIST", profile: artist.stageName },
    { tester, account: venue.email, role: "VENUE", profile: venue.profile.name },
  ]));
}

function explainActivation(pending) {
  const list = pending.map((email) => `'${email}'`).join(", ");
  console.log(`
${pending.length} account(s) are not active yet (or exist with another password). Activate them either way:
  a) each tester clicks the activation link in the e-mail sent to the address above, or
  b) all at once: Coolify -> the stack -> Terminal -> postgres container, then run

psql -U spotonslot -d spotonslot -c "UPDATE identity_user SET status = 'ACTIVE', email_verified_at = now(), updated_at = now() WHERE status = 'PENDING_VERIFICATION' AND email IN (${list});"

Then run this script again with the same settings to fill the profiles.`);
}

async function checkBackend() {
  try {
    const response = await fetch(`${API}/actuator/health`);
    if (!response.ok) throw new Error(String(response.status));
  } catch (error) {
    fail(`The backend is not reachable at ${API}/actuator/health (${error.message}).`);
  }
}

await main();
