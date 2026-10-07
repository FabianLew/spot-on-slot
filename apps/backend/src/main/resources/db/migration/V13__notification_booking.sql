-- Booking notifications (W9): the booking a BOOKING notification is about; several per booking (one per step).
ALTER TABLE notification ADD COLUMN booking_id uuid;
