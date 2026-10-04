# AI development workflow

Same story-based flow as ecommerce-flow.

- `stories/phase-XX-<name>/STORY-XXX-<slug>.md`: scope, requirements, acceptance criteria.
- `prompts/phase-XX-<name>/STORY-XXX-{impl,review,fix}.md`: prompt chain for implementation, review and fixes.

Flow: story → impl → review → fix (if needed) → done. Phases follow section 7 of `docs/architecture.md`:

1. Foundation (this skeleton)
2. Accounts and profiles: identity, artist, venue, media, location
3. Availability and listings: availability, listing, search with map
4. Booking and contact: booking, messaging, notification
5. Landing + public profiles + PWA → MVP launch
6. Mobile (Expo), reviews, payments, subscriptions
