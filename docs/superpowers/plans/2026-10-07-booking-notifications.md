# Booking notifications (B10 follow-up to B12)

Promised in the B10 spec: once B12 is in main, booking steps become notifications in the app and by e-mail, with no daily limit.

- `NotificationType.BOOKING`, `notification.booking_id` (V13), payload `BookingUpdate` (step, recipient's side, who acted, the other side's name, time, amount).
- `BookingNotifications` listens to `BookingRequested|Countered|Accepted|Declined|Withdrawn|Cancelled|Expired`: the other side hears about each step (venue acted → artist; artist acted → whole venue team; expiry → both; system decline after the artist got booked → the venue), the person who acted is skipped.
- `BookingMailer` e-mails every one on the shared `MailLayout` (from PR #22), link `/bookings/{id}`; no setting, like account e-mails.
- Bell (`NotificationItem`): booking steps read from the viewer's side ("Klub pyta o termin"), with time and fee, and open the booking.
- Tests: `BookingNotificationIntegrationTest`, `notifications.test.tsx`.
