-- One location per subject (a user now, venues in B5). subject_id has no foreign key: modules own their tables.
-- People's locations are stored approximated to a 0.01° grid (precision APPROXIMATE); never the exact point.
CREATE TABLE location
(
    id            uuid             PRIMARY KEY,
    created_at    timestamptz      NOT NULL,
    updated_at    timestamptz      NOT NULL,
    version       bigint           NOT NULL,
    subject_type  varchar(16)      NOT NULL,
    subject_id    uuid             NOT NULL,
    source        varchar(16)      NOT NULL,
    precision     varchar(16)      NOT NULL,
    label         varchar(200)     NOT NULL,
    city          varchar(120)     NOT NULL,
    region        varchar(120),
    country_code  varchar(2),
    latitude      double precision NOT NULL,
    longitude     double precision NOT NULL,
    -- Computed by the database so JPA maps plain numbers; radius queries use this column and its index.
    point         geography(Point, 4326) GENERATED ALWAYS AS
                      (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    CONSTRAINT location_subject_uq UNIQUE (subject_type, subject_id)
);

CREATE INDEX location_point_idx ON location USING gist (point);
