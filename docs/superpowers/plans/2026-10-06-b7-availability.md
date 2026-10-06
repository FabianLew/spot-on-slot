# B7: dostępność artysty, plan implementacji

Spec: `docs/superpowers/specs/2026-10-06-b7-availability-design.md` (zaakceptowany 2026-10-06, wolne sloty). Backend + wygenerowany klient, bez ekranów (W6).

## Kroki (test-first)

1. **Testy integracyjne** `AvailabilityIntegrationTest` dla:
   - slotów, reguł, zakresów, nakładania, północy i zmiany czasu;
   - pomijania dni, limitów, widoku publicznego;
   - fasady (wolny, zajęcie, zwolnienie).

   Plus testy jednostkowe rozwijania reguł (`AvailabilityRuleTest`).
2. **Migracja `V8__availability.sql`:**
   - `availability_slot` (owner, `starts_at`/`ends_at` `timestamptz`, status FREE/BOOKED, notatka, `booking_id`);
   - `availability_rule` (dni tygodnia, godzina, czas trwania w minutach, `valid_from`/`valid_until`, strefa, notatka) z tabelami `availability_rule_day` i `availability_rule_skip`.
3. **Domena:**
   - `AvailabilitySlot`, `AvailabilityRule` (rozwija wystąpienia w zakresie w swojej strefie);
   - `Occurrence`, czyli wspólna postać terminu;
   - `AvailabilityErrors`.
4. **Aplikacja:** `AvailabilityService` z kalendarzem, slotami, regułami, pomijaniem i widokiem publicznym. Sprawdza nakładanie pod blokadą `pg_advisory_xact_lock` na artystę.
5. **API:**
   - `AvailabilityController` (`/api/v1/availability/me/...`, rola ARTIST, wymagany profil przez `ArtistProfiles`);
   - `PublicAvailabilityController` (`/api/v1/public/artists/{slug}/availability`).
6. **Fasada `Availability`:**
   - `isFree`, `freeAmong` (pod B9);
   - `occupy`, `release` (pod B10).

   `ArtistProfiles` dostaje `exists` i `findPublishedBySlug`.
7. **Pozostałe zmiany:**
   - teksty błędów PL/EN;
   - `./gradlew test` z `ModularityTest`;
   - `pnpm api:generate` i commit `schema.d.ts`;
   - wpis w CLAUDE.md.
