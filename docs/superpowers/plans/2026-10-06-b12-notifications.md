# B12 notifications (backend): implementation plan

Spec: `docs/superpowers/specs/2026-10-06-b12-notifications-design.md` (W11 screens follow after W8).

## Approach

No broker: `listing.ListingPublished` is already stored in Modulith's event publication registry with the listing
(a transactional outbox) and handled after commit on another thread. `notification` finds the recipients through
facades, stores one `notification` row each and publishes `NotificationCreated` per row; channels listen to that
event (e-mail now). A broker can carry `NotificationCreated` later via spring-modulith-events-amqp.

## Steps

1. `NearbyListingAlertIntegrationTest` (test-first): who is alerted in both directions (travel radius, genres,
   unpublished, author's team, one alert per person, booked artists skipped, "free" flag), settings, defaults and
   validation, reading (list, unread count, read, read all, inactive listing), e-mail (language, links, headers,
   unsubscribe), five e-mails a day, no e-mail for an ended listing, retention.
2. Facades: `Availability.bookedAmong`, `Venues.teamsOf`, `Listings.activeAmong`; `ActiveListing` gains
   `travelRadiusKm` and `city`.
3. `V10__notification.sql`: `notification` (jsonb payload, one per person and listing), `notification_preference`
   (+ genres).
4. `notification`: `NearbyListingAlerts` (listener), `NearbyListingMailer` (listener on `NotificationCreated`, per-person
   advisory lock for the daily limit), `NotificationService`, `NotificationCleanupJob`, controllers, messages PL/EN
   (incl. genre names), `MailSender` headers.
5. `./gradlew test` (incl. `ModularityTest`), `pnpm api:generate`, CLAUDE.md bullet, PR.
