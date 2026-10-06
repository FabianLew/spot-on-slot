-- Listings (B8): "I'm free" from an artist (time taken from their calendar) and "looking for an artist" from a venue.
-- artist_id / venue_id / author_id have no foreign keys: modules own their tables.
-- The point is copied when the listing is posted (artists: the approximated ~1 km point, venues: the exact one),
-- so moving later does not move old listings; search (B9) queries it.
CREATE TABLE listing
(
    id               uuid          PRIMARY KEY,
    created_at       timestamptz   NOT NULL,
    updated_at       timestamptz   NOT NULL,
    version          bigint        NOT NULL,
    kind             varchar(24)   NOT NULL,
    status           varchar(16)   NOT NULL,
    author_id        uuid          NOT NULL,
    artist_id        uuid,
    venue_id         uuid,
    starts_at        timestamptz   NOT NULL,
    ends_at          timestamptz   NOT NULL,
    description      varchar(1000),
    price_from       bigint,
    price_to         bigint,
    travel_radius_km integer,
    city             varchar(120),
    latitude         double precision NOT NULL,
    longitude        double precision NOT NULL,
    point            geography(Point, 4326) GENERATED ALWAYS AS
                         (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    closed_at        timestamptz,
    CONSTRAINT listing_range_ck CHECK (ends_at > starts_at),
    CONSTRAINT listing_subject_ck CHECK (
        (kind = 'ARTIST_AVAILABLE' AND artist_id IS NOT NULL AND venue_id IS NULL)
        OR (kind = 'VENUE_SEEKING' AND venue_id IS NOT NULL AND artist_id IS NULL))
);

CREATE INDEX listing_point_idx ON listing USING gist (point);
CREATE INDEX listing_status_start_idx ON listing (status, starts_at);
CREATE INDEX listing_artist_idx ON listing (artist_id, starts_at);
CREATE INDEX listing_venue_idx ON listing (venue_id, starts_at);

CREATE TABLE listing_genre
(
    listing_id uuid        NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
    genre      varchar(32) NOT NULL,
    PRIMARY KEY (listing_id, genre)
);
