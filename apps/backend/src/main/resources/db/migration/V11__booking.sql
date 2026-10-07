-- Bookings (B10): a venue's request to an artist, or an artist's application to a venue's listing, negotiated
-- by offers and counter-offers until accepted, declined, withdrawn, cancelled, expired or completed.
-- artist_id / venue_id / listing_id have no foreign keys: modules own their tables. The stage name and venue
-- name are copied when the booking starts, so an unpublished profile later does not blank it.
-- (V10 is taken by notifications, B12.)
CREATE TABLE booking
(
    id                uuid          PRIMARY KEY,
    created_at        timestamptz   NOT NULL,
    updated_at        timestamptz   NOT NULL,
    version           bigint        NOT NULL,
    artist_id         uuid          NOT NULL,
    venue_id          uuid          NOT NULL,
    listing_id        uuid,
    initiator         varchar(8)    NOT NULL,
    created_by        uuid          NOT NULL,
    status            varchar(16)   NOT NULL,
    -- Whose answer a pending booking waits for; null once it is closed.
    awaiting          varchar(8),
    starts_at         timestamptz   NOT NULL,
    ends_at           timestamptz   NOT NULL,
    amount            bigint        NOT NULL,
    -- The number of the current proposal; an acceptance names it.
    revision          integer       NOT NULL,
    respond_by        timestamptz   NOT NULL,
    closed_at         timestamptz,
    artist_stage_name varchar(60)   NOT NULL,
    venue_name        varchar(120)  NOT NULL,
    CONSTRAINT booking_range_ck CHECK (ends_at > starts_at),
    CONSTRAINT booking_amount_ck CHECK (amount >= 0)
);

CREATE INDEX booking_artist_idx ON booking (artist_id, starts_at);
CREATE INDEX booking_venue_idx ON booking (venue_id, starts_at);
CREATE INDEX booking_status_idx ON booking (status, respond_by);

-- The history: every request, counter-offer and answer with the terms at that step.
CREATE TABLE booking_step
(
    id         uuid          PRIMARY KEY,
    created_at timestamptz   NOT NULL,
    updated_at timestamptz   NOT NULL,
    version    bigint        NOT NULL,
    booking_id uuid          NOT NULL REFERENCES booking (id) ON DELETE CASCADE,
    seq        integer       NOT NULL,
    type       varchar(16)   NOT NULL,
    party      varchar(8)    NOT NULL,
    actor_id   uuid,
    occurred_at timestamptz  NOT NULL,
    starts_at  timestamptz   NOT NULL,
    ends_at    timestamptz   NOT NULL,
    amount     bigint        NOT NULL,
    message    varchar(1000),
    CONSTRAINT booking_step_seq_uq UNIQUE (booking_id, seq)
);
