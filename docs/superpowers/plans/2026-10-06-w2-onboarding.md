# W2 onboarding wizard: implementation plan

Spec: `docs/superpowers/specs/2026-10-06-w2-onboarding-design.md` (approved 2026-10-06).

**Ground rules:** test first per task; before push `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. No backend changes are expected; if one turns out necessary, run the backend tests, then `pnpm api:generate`.

1. **`packages/ui`.**
   - `Stepper`: an ordered list of steps with `aria-current="step"`, done and upcoming states, and a "Step n of m" label from props.
   - `ChoiceChips`: toggle buttons with `aria-pressed` inside a `fieldset` with a legend. It takes a `max` limit (the remaining chips are disabled once it is reached) and an error with an icon.
   - Tests for both; export them from `index.ts`.
2. **Profile helpers (`apps/web/src/components/onboarding`).**
   - `profile-requests.ts`: builds the full `SaveProfileRequest` / `SaveVenueRequest` from what is saved plus a patch, so a step never drops fields.
   - `use-onboarding.ts`: queries for the artist profile (404 = none), the location and the user's venues (the first one), plus the first missing step from `missingForPublication`.
   - `skip.ts`: the skip flag in `localStorage` per user, wrapped in try/catch.
3. **Wizards.**
   - `ArtistWizard`, in four steps: stage name + genres (form + zod), photo (`ImagePicker` + `uploadImage`), location (`LocationPicker`, device or suggestion), summary (publish or draft).
   - `VenueWizard`, in four steps:
     - name + type (`POST /venues` the first time, `PUT` afterwards);
     - address: suggestions fill street, postal code, city and point; a manual edit drops the point, so the backend geocodes the address;
     - genres + photo;
     - summary.
   - `WizardFrame` holds the shared parts: the stepper, back and next, and "Uzupełnię później".
4. **Routes and gate.**
   - The `(onboarding)/onboarding` page has its own layout (logo, language, sign-out) behind `AuthGate`.
   - Roles other than ARTIST and VENUE get a short message with a link to the dashboard.
   - `OnboardingGate` in `(app)/layout.tsx` redirects to `/onboarding` when there is no profile and no skip.
   - Dashboard gets a `ProfileReminder` card until the profile is published.
5. **Copy:** PL/EN `onboarding.*`, `genres.*` and `venueTypes.*`, keeping key parity.
6. **Tests:** both wizards (mocked `fetch`), resuming at the first missing step, skipping, the gate and the reminder.
7. **Wrap-up.**
   - End-to-end run against the backend with the Photon stub.
   - Screenshots to `/mnt/project-files/w2-screens/`.
   - Docs (`CLAUDE.md`), then the PR.
