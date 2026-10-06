-- Venues and their teams. user_id/invited_by have no foreign key: modules own their tables.
-- published_at null = draft, only published venues are public under /v/{slug}.
-- A venue's address is business data: its point is exact (people's locations are approximated, see V5).
CREATE TABLE venue
(
    id              uuid             PRIMARY KEY,
    created_at      timestamptz      NOT NULL,
    updated_at      timestamptz      NOT NULL,
    version         bigint           NOT NULL,
    slug            varchar(40)      NOT NULL,
    name            varchar(120)     NOT NULL,
    type            varchar(16)      NOT NULL,
    description     varchar(2000),
    capacity        integer,
    street          varchar(120),
    postal_code     varchar(12),
    city            varchar(120),
    latitude        double precision,
    longitude       double precision,
    -- Computed by the database so JPA maps plain numbers; radius queries (B9) use this column and its index.
    point           geography(Point, 4326) GENERATED ALWAYS AS
                        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    avatar_media_id uuid,
    published_at    timestamptz,
    CONSTRAINT venue_slug_uq UNIQUE (slug),
    CONSTRAINT venue_point_check CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX venue_point_idx ON venue USING gist (point);
CREATE INDEX venue_avatar_idx ON venue (avatar_media_id);

CREATE TABLE venue_member
(
    id         uuid        PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version    bigint      NOT NULL,
    venue_id   uuid        NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL,
    role       varchar(16) NOT NULL,
    CONSTRAINT venue_member_uq UNIQUE (venue_id, user_id)
);

CREATE INDEX venue_member_user_idx ON venue_member (user_id);

-- Only the SHA-256 of the token is stored; the raw token travels in the e-mail.
CREATE TABLE venue_invitation
(
    id         uuid         PRIMARY KEY,
    created_at timestamptz  NOT NULL,
    updated_at timestamptz  NOT NULL,
    version    bigint       NOT NULL,
    venue_id   uuid         NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    email      varchar(254) NOT NULL,
    role       varchar(16)  NOT NULL,
    token_hash varchar(64)  NOT NULL,
    invited_by uuid         NOT NULL,
    expires_at timestamptz  NOT NULL,
    CONSTRAINT venue_invitation_token_uq UNIQUE (token_hash),
    CONSTRAINT venue_invitation_email_uq UNIQUE (venue_id, email)
);

CREATE TABLE venue_genre
(
    venue_id uuid        NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    genre    varchar(32) NOT NULL,
    PRIMARY KEY (venue_id, genre)
);

CREATE TABLE venue_tag
(
    venue_id uuid        NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    position integer     NOT NULL,
    tag      varchar(30) NOT NULL,
    PRIMARY KEY (venue_id, position)
);

CREATE TABLE venue_link
(
    venue_id uuid         NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    kind     varchar(16)  NOT NULL,
    url      varchar(300) NOT NULL,
    PRIMARY KEY (venue_id, kind)
);

CREATE TABLE venue_photo
(
    venue_id uuid    NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
    position integer NOT NULL,
    media_id uuid    NOT NULL,
    PRIMARY KEY (venue_id, position)
);

CREATE INDEX venue_photo_media_idx ON venue_photo (media_id);
