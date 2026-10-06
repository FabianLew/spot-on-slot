# B5 venue profile: implementation plan

Spec: `docs/superpowers/specs/2026-10-06-b5-venue-profile-design.md` (approved 2026-10-06).

**Ground rules:** test first per task; backend tests need Docker; `./gradlew test` in `apps/backend`; after API changes `pnpm api:generate` and commit `schema.d.ts`; before push `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

1. **Shared pieces.** The venue module needs the same address and link rules as artists.
   - Move `Slugs` to `shared.text` and give it a per-module fallback; `SlugsTest` moves along.
   - Move the https host check to `shared.text.HttpsLinks`.
   - `Genre` moves to the `artist` root package as the genre catalogue other modules reference.
   - Add `ForbiddenException` (403) to `shared.error`.
   - Artist tests stay green.
2. **Facades in other modules.**
   - `location`:
     - `Place` gains a `kind`;
     - `Locations.geocodeAddress(query, locale)` returns the best house or street match with its exact point, or nothing;
     - an unavailable geocoder still gives 503.
   - `identity`: `Accounts` (root) gives an account's e-mail, role and locale, and e-mails for a set of ids.
3. **Migration + domain.**
   - `V7__venue.sql`:
     - `venue` with a unique `slug`, address, nullable `latitude`/`longitude` and a generated PostGIS point with a GIST index;
     - `venue_member` with a unique (venue, user) pair;
     - `venue_invitation` with a unique `token_hash` and a unique (venue, e-mail) pair;
     - collection tables `venue_genre`, `venue_tag`, `venue_link`, `venue_photo`;
     - all child rows cascade on delete.
   - Entities: `Venue`, `VenueMember`, `VenueInvitation`.
   - Enums: `VenueType`, `VenueLinkKind`, and `VenueRole` (root, public).
   - `VenueErrors`.
4. **Service + API.**
   - `VenueService`:
     - create (limit 10 memberships, the creator becomes owner) and save (address geocoded outside the transaction, only when it changed and no point was picked);
     - photo ownership is checked only for newly added photos, against the person saving;
     - publish and unpublish with missing fields, delete, slug check;
     - `MediaDeleted` listener.
   - `VenueTeamService`:
     - team list, invite (replaces a pending invite for the same e-mail, refuses existing members) and cancel;
     - remove a member (owner, or yourself) and the last-owner rule;
     - accept (token, same e-mail, VENUE role, limit).
     - Publishes `VenueInvitationSent`.
   - Controllers `/api/v1/venues/**` (`hasRole('VENUE')`) and `/api/v1/public/venues/{slug}`. Non-members get 404 and managers 403 on owner actions.
   - The invitation token travels in the request body (`POST /api/v1/venues/invitations/accept`), not the path, so it never lands in access logs.
   - Facade `Venues` for B8, B9 and B10: the venues a user manages and a published venue's summary with its point.
   - `notification`: `VenueInvitationMailer` sends the PL/EN invitation mail with a link to `WEB_BASE_URL/venue-invitation?token=…`.
5. **Integration tests.** All the cases in spec section 4, plus the invitation mail; `ModularityTest` green.
6. **Wrap-up.** `pnpm api:generate`, docs (`CLAUDE.md`, architecture), then the PR.
