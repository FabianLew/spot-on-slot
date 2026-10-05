-- Presigned uploads waiting for the browser's PUT and the completion call; deleted once processed.
-- owner_id has no foreign key: modules own their tables, account deletion reaches media through events (B14).
CREATE TABLE media_upload
(
    id           uuid         PRIMARY KEY,
    created_at   timestamptz  NOT NULL,
    updated_at   timestamptz  NOT NULL,
    version      bigint       NOT NULL,
    owner_id     uuid         NOT NULL,
    object_key   varchar(200) NOT NULL,
    content_type varchar(32)  NOT NULL,
    size_bytes   bigint       NOT NULL,
    expires_at   timestamptz  NOT NULL
);

CREATE INDEX media_upload_owner_idx ON media_upload (owner_id);
CREATE INDEX media_upload_created_idx ON media_upload (created_at);

-- A processed image: three WebP variants, no original.
CREATE TABLE media
(
    id          uuid         PRIMARY KEY,
    created_at  timestamptz  NOT NULL,
    updated_at  timestamptz  NOT NULL,
    version     bigint       NOT NULL,
    owner_id    uuid         NOT NULL,
    width       integer      NOT NULL,
    height      integer      NOT NULL,
    small_key   varchar(200) NOT NULL,
    medium_key  varchar(200) NOT NULL,
    large_key   varchar(200) NOT NULL
);

CREATE INDEX media_owner_idx ON media (owner_id);
