-- The booking that filled a listing (W9 links it from the author's list). No foreign key: booking owns its table.
ALTER TABLE listing ADD COLUMN booking_id uuid;
