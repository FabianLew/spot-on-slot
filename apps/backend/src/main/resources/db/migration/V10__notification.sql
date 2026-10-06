-- Notifications (B12): what a user was told in the app, and their settings per category.
-- recipient_id / listing_id / user_id have no foreign keys: modules own their tables.
CREATE TABLE notification
(
    id             uuid        PRIMARY KEY,
    created_at     timestamptz NOT NULL,
    updated_at     timestamptz NOT NULL,
    version        bigint      NOT NULL,
    recipient_id   uuid        NOT NULL,
    type           varchar(32) NOT NULL,
    -- The listing a NEARBY_LISTING alert is about; one alert per person and listing.
    listing_id     uuid,
    -- What the list and the e-mail show, frozen when the notification was made.
    payload        jsonb       NOT NULL,
    read_at        timestamptz,
    email_sent_at  timestamptz
);

CREATE INDEX notification_recipient_idx ON notification (recipient_id, created_at DESC);
CREATE INDEX notification_unread_idx ON notification (recipient_id) WHERE read_at IS NULL;
CREATE INDEX notification_emailed_idx ON notification (recipient_id, email_sent_at) WHERE email_sent_at IS NOT NULL;
CREATE INDEX notification_created_idx ON notification (created_at);
CREATE UNIQUE INDEX notification_listing_uq ON notification (recipient_id, listing_id) WHERE listing_id IS NOT NULL;

-- Settings of a user; no row = defaults (alerts on, e-mail on, radius and genres from the profile).
CREATE TABLE notification_preference
(
    id                 uuid        PRIMARY KEY,
    created_at         timestamptz NOT NULL,
    updated_at         timestamptz NOT NULL,
    version            bigint      NOT NULL,
    user_id            uuid        NOT NULL,
    nearby_enabled     boolean     NOT NULL,
    nearby_email       boolean     NOT NULL,
    -- NULL = the default (artists: travel radius from the profile; venues: 50 km).
    nearby_radius_km   integer,
    -- Turns e-mails of a category off from a link without signing in; only switches e-mails off.
    unsubscribe_token  varchar(64) NOT NULL,
    CONSTRAINT notification_preference_user_uq UNIQUE (user_id),
    CONSTRAINT notification_preference_token_uq UNIQUE (unsubscribe_token),
    CONSTRAINT notification_preference_radius_ck CHECK (nearby_radius_km BETWEEN 5 AND 200)
);

-- Empty = the genres of the profile (artists) or of the venues (venue teams).
CREATE TABLE notification_preference_genre
(
    preference_id uuid        NOT NULL REFERENCES notification_preference (id) ON DELETE CASCADE,
    genre         varchar(32) NOT NULL,
    PRIMARY KEY (preference_id, genre)
);
