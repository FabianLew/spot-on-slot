# W3 artist profile screens: implementation plan

Spec: `docs/superpowers/specs/2026-10-06-w3-artist-profile-design.md` (approved 2026-10-06).

**Ground rules:** test first per task; before push `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. No backend changes.

1. **`packages/ui`.**
   - `TagInput`: chips with remove buttons plus an input; Enter or comma adds a tag. It enforces a limit and a maximum length, and labels come from props.
   - `SkillSlider`: a range input from 0 to 10 (0 = not set) with a pixel readout.
   - Tests for both.
2. **Shared view (`components/artist`).**
   - `ArtistProfileView` renders public profile data in the mockup layout (photo, name, town, radius, genres, skills, bio, links, rate, gallery).
   - It has no hooks besides `useTranslations`, so it works in server and client components.
3. **Profile tab (`/profile`).**
   - Artists see a status bar (draft or published, publish and unpublish, copy link, edit) over the view.
   - Without a profile they get a link to the wizard.
   - Venues see a W4 note.
4. **Edit (`/profile/edit`).**
   - One form (react-hook-form + zod) with sections for basics and slug (availability check on blur), music, bio, photos (avatar + gallery up to 12, arrows to reorder), links, rate in zł with travel radius, and skills.
   - Location has its own picker that saves immediately.
   - Save sends the whole profile, server errors go to fields, and leaving with unsaved changes asks first.
5. **Public page (`/a/[slug]`).**
   - Rendered on the server from `GET /api/v1/public/artists/{slug}` (no token).
   - A 404 shows `notFound()`.
   - Metadata: title, description, Open Graph image, `robots: noindex`.
   - It has its own minimal layout.
6. **Wizard link.**
   - The W2 summary links to `/profile/edit`.
   - The dashboard reminder stays as is.
7. **Copy:** PL/EN `profile.*`, with key parity.
8. **Tests:**
   - the view (private fields absent);
   - the status bar and publish flow;
   - the edit form (whole-profile save, field errors, slug taken, gallery reorder, tags, sliders);
   - the public page loader (404).
9. **Wrap-up:**
   - an end-to-end run against the real backend and screenshots to `/mnt/project-files/w3-screens/`;
   - a `CLAUDE.md` note, then the PR.
