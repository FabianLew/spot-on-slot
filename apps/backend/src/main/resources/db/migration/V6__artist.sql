-- One profile per ARTIST account. owner_id has no foreign key: modules own their tables.
-- Money in grosze (PLN). published_at null = draft, only published profiles are public under /a/{slug}.
CREATE TABLE artist_profile
(
    id               uuid         PRIMARY KEY,
    created_at       timestamptz  NOT NULL,
    updated_at       timestamptz  NOT NULL,
    version          bigint       NOT NULL,
    owner_id         uuid         NOT NULL,
    slug             varchar(40)  NOT NULL,
    stage_name       varchar(60)  NOT NULL,
    first_name       varchar(60),
    last_name        varchar(80),
    bio              varchar(2000),
    rate_from        bigint,
    rate_to          bigint,
    travel_radius_km integer      NOT NULL,
    skill_tempo      integer,
    skill_experience integer,
    skill_energy     integer,
    skill_vinyl      integer,
    skill_cdj        integer,
    skill_production integer,
    avatar_media_id  uuid,
    published_at     timestamptz,
    CONSTRAINT artist_profile_owner_uq UNIQUE (owner_id),
    CONSTRAINT artist_profile_slug_uq UNIQUE (slug)
);

CREATE TABLE artist_genre
(
    profile_id uuid        NOT NULL REFERENCES artist_profile (id) ON DELETE CASCADE,
    genre      varchar(32) NOT NULL,
    PRIMARY KEY (profile_id, genre)
);

CREATE TABLE artist_tag
(
    profile_id uuid        NOT NULL REFERENCES artist_profile (id) ON DELETE CASCADE,
    position   integer     NOT NULL,
    tag        varchar(30) NOT NULL,
    PRIMARY KEY (profile_id, position)
);

CREATE TABLE artist_link
(
    profile_id uuid         NOT NULL REFERENCES artist_profile (id) ON DELETE CASCADE,
    kind       varchar(16)  NOT NULL,
    url        varchar(300) NOT NULL,
    PRIMARY KEY (profile_id, kind)
);

CREATE TABLE artist_photo
(
    profile_id uuid    NOT NULL REFERENCES artist_profile (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    media_id   uuid    NOT NULL,
    PRIMARY KEY (profile_id, position)
);

CREATE INDEX artist_photo_media_idx ON artist_photo (media_id);
CREATE INDEX artist_profile_avatar_idx ON artist_profile (avatar_media_id);
