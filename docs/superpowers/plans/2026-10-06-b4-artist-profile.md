# B4 artist profile: implementation plan

Spec: `docs/superpowers/specs/2026-10-05-b4-artist-profile-design.md` (approved 2026-10-06).

**Ground rules:** test first per task; backend tests need Docker; `./gradlew test` in `apps/backend`; after API changes `pnpm api:generate` and commit `schema.d.ts`; before push `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

1. **Facades in other modules.**
   - `media`: `MediaLibrary` (root) gives a `MediaImage` with variant URLs, either by id or for a set of ids owned by one user. `MediaService.delete` publishes `MediaDeleted(mediaId, ownerId)`.
   - `location`: `Locations.findForUser(userId)` returns a `LocationSummary` (label, city, region, country code) without coordinates.
2. **Migration + domain.**
   - `V6__artist.sql`: `artist_profile` with unique `owner_id` and `slug`, plus collection tables `artist_genre`, `artist_tag`, `artist_link` and `artist_photo`.
   - `ArtistProfile` entity: element collections, an embedded `Skills` record, a `Genre` enum (about 20 codes) and a `LinkKind` enum with the allowed hosts.
   - `Slugs` (unit-tested): turns a stage name into a slug (Polish letters folded, `ł` → `l`), checks the pattern and the reserved words.
   - `ArtistErrors`.
3. **Service + API.**
   - `ArtistProfileService`:
     - `get` and `save`: create or replace, generate the slug on create, check a requested slug, check that the photos belong to the artist, map a unique-constraint violation to `ARTIST_PROFILE_CONFLICT`;
     - `publish` and `unpublish`, plus the list of missing fields;
     - `slugAvailable`, `publicProfile`.
   - Controller `/api/v1/artists/**` (`hasRole('ARTIST')` for `me` endpoints) and `/api/v1/public/artists/{slug}` (added to `PUBLIC_PATHS`).
   - Link validation through a constraint `@ArtistLink(kind)` with PL/EN messages.
   - Listener on `MediaDeleted` removes the photo from profiles.
   - Facade `ArtistProfiles.findPublishedByOwner` for B9 and B10.
4. **Integration tests:**
   - roles and access: saving, reading, role checks, the anonymous public endpoint;
   - slug handling: generation, collision, reserved words, changes, the availability check;
   - validation: links, genres, tags, rates and skills;
   - photos: someone else's photo, deleting a photo through `media`;
   - publishing: missing fields, publish and unpublish, the public view without private data, 404 for a draft.
   - `ModularityTest` must stay green.
5. **Wrap-up.** `pnpm api:generate`, docs (`CLAUDE.md`), then the PR.
