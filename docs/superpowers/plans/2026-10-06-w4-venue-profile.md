# W4: profil lokalu, plan implementacji

Spec: `docs/superpowers/specs/2026-10-06-w4-venue-profile-design.md` (zaakceptowany 2026-10-06). Tylko `apps/web`, API B5 bez zmian.

## Kroki (test-first)

1. **Wspólne elementy profilu** (`components/profile/`):
   - `StatusBar`: szkic/opublikowany, braki, przyciski, kopiowanie linku; teksty w `profileStatus.*`;
   - `PhotoGalleryView` i `ExternalLinks` z widoku artysty.
   Artysta przechodzi na nie bez zmiany zachowania (istniejące testy W3 zostają zielone).
2. **`VenueProfileView`** (`components/venue/venue-profile-view.tsx`), wspólny dla podglądu i `/v/{slug}`. Test: pola publiczne, brak zespołu.
3. **`MyVenues`** w `/profile` dla VENUE:
   - przełącznik (`?venue=`), „Dodaj lokal” (`/onboarding?new=venue`, wyłączony przy 10);
   - publikacja tylko właściciel.
   Kreator dostaje tryb nowego lokalu (`fresh`), a lista lokali w cache trzyma kolejność „najstarszy pierwszy”.
4. **Formularz lokalu** (`venue-form-values.ts` + `venue-form.tsx`, `/profile/venues/[id]/edit`):
   - pola adresu wydzielone do `VenueAddressFields` i użyte też w kreatorze;
   - slug sprawdzany przez `GET /venues/slugs/{slug}?venueId=`;
   - po zapisie ostrzeżenie, gdy adres nie trafił na mapę;
   - strefa usuwania z wpisaniem nazwy.
5. **Zespół** (`venue-team.tsx`, `/profile/venues/[id]/team`): lista, zaproszenie, cofnięcie, usunięcie, opuszczenie, ostatni właściciel.
6. **Zaproszenie** (`invitation-accept.tsx`, `(onboarding)/venue-invitation`): akceptacja, błąd z wylogowaniem.
7. **Strona publiczna** `/v/[slug]` + `findPublicVenue`.
8. **Teksty** PL/EN (`venueProfile.*`, `profileStatus.*`), CLAUDE.md, `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
9. **E2E** z backendem i Mailpit, zrzuty do `w4-screens/`.
