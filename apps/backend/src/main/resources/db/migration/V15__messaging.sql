-- Messaging (B11): conversations between an artist and a venue's team, their messages and each person's read state.
-- artist_id / venue_id / booking_id / started_by / sender_id / user_id have no foreign keys: modules own their tables.
CREATE TABLE conversation
(
    id              uuid         PRIMARY KEY,
    created_at      timestamptz  NOT NULL,
    updated_at      timestamptz  NOT NULL,
    version         bigint       NOT NULL,
    -- DIRECT: one per artist and venue; BOOKING: the thread of one booking.
    kind            varchar(16)  NOT NULL,
    artist_id       uuid         NOT NULL,
    venue_id        uuid         NOT NULL,
    booking_id      uuid,
    -- Names when the conversation started, shown once a profile is no longer published.
    artist_name     varchar(60)  NOT NULL,
    venue_name      varchar(120) NOT NULL,
    -- The person who started a direct conversation (the daily limit counts these).
    started_by      uuid,
    -- The side that blocked a direct conversation (ARTIST or VENUE).
    blocked_by      varchar(16),
    blocked_at      timestamptz,
    last_message_at timestamptz,
    CONSTRAINT conversation_kind_ck CHECK (kind IN ('DIRECT', 'BOOKING')),
    CONSTRAINT conversation_booking_ck CHECK ((kind = 'BOOKING') = (booking_id IS NOT NULL)),
    CONSTRAINT conversation_blocked_ck CHECK (blocked_by IS NULL OR kind = 'DIRECT')
);

CREATE UNIQUE INDEX conversation_direct_uq ON conversation (artist_id, venue_id) WHERE kind = 'DIRECT';
CREATE UNIQUE INDEX conversation_booking_uq ON conversation (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX conversation_artist_idx ON conversation (artist_id, last_message_at DESC);
CREATE INDEX conversation_venue_idx ON conversation (venue_id, last_message_at DESC);
CREATE INDEX conversation_started_idx ON conversation (started_by, created_at) WHERE started_by IS NOT NULL;
CREATE INDEX conversation_last_message_idx ON conversation (last_message_at);

CREATE TABLE conversation_message
(
    id              uuid          PRIMARY KEY,
    created_at      timestamptz   NOT NULL,
    updated_at      timestamptz   NOT NULL,
    version         bigint        NOT NULL,
    conversation_id uuid          NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
    sender_id       uuid          NOT NULL,
    sender_side     varchar(16)   NOT NULL,
    body            varchar(2000) NOT NULL,
    -- Set by the browser so that a retried send does not post twice.
    client_id       varchar(64),
    CONSTRAINT conversation_message_client_uq UNIQUE (conversation_id, sender_id, client_id)
);

CREATE INDEX conversation_message_history_idx ON conversation_message (conversation_id, created_at DESC, id DESC);
CREATE INDEX conversation_message_sender_idx ON conversation_message (sender_id, created_at);

-- How far a person has read a conversation, and when they were last e-mailed about it.
CREATE TABLE conversation_read
(
    id              uuid        PRIMARY KEY,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NOT NULL,
    version         bigint      NOT NULL,
    conversation_id uuid        NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL,
    -- The time of the newest message read; NULL = nothing read yet.
    read_up_to      timestamptz,
    read_at         timestamptz,
    reminded_at     timestamptz,
    CONSTRAINT conversation_read_uq UNIQUE (conversation_id, user_id)
);

-- E-mails about unread messages (on by default).
ALTER TABLE notification_preference ADD COLUMN message_email boolean NOT NULL DEFAULT true;
