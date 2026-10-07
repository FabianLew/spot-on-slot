-- B14: account settings and deletion (GDPR).

-- An account can wait for deletion (restorable for the grace period, then purged by AccountPurgeJob).
ALTER TABLE identity_user
    DROP CONSTRAINT identity_user_status_check,
    ADD CONSTRAINT identity_user_status_check
        CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED', 'DELETION_PENDING')),
    ADD COLUMN deletion_requested_at timestamptz;

CREATE INDEX identity_user_deletion_idx ON identity_user (deletion_requested_at)
    WHERE deletion_requested_at IS NOT NULL;

-- Changing the e-mail address: the link goes to the new address, which the token stores until it is confirmed.
ALTER TABLE identity_token
    DROP CONSTRAINT identity_token_type_check,
    ADD CONSTRAINT identity_token_type_check CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE')),
    ADD COLUMN target_email varchar(254);

-- Bookings and conversations stay with the other side after an account is purged; the purged person's messages
-- are erased and shown as "message deleted".
ALTER TABLE booking_step ADD COLUMN message_deleted boolean NOT NULL DEFAULT false;
CREATE INDEX booking_step_actor_idx ON booking_step (actor_id) WHERE actor_id IS NOT NULL;

ALTER TABLE conversation_message ADD COLUMN deleted boolean NOT NULL DEFAULT false;

-- Lookups by person when an account is closed or purged.
CREATE INDEX listing_author_idx ON listing (author_id);
CREATE INDEX venue_invitation_invited_by_idx ON venue_invitation (invited_by);
CREATE INDEX conversation_read_user_idx ON conversation_read (user_id);
