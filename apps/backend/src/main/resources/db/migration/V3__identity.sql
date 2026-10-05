CREATE TABLE identity_user
(
    id                         uuid         PRIMARY KEY,
    created_at                 timestamptz  NOT NULL,
    updated_at                 timestamptz  NOT NULL,
    version                    bigint       NOT NULL,
    email                      varchar(254) NOT NULL,
    password_hash              varchar(255) NOT NULL,
    role                       varchar(16)  NOT NULL,
    status                     varchar(24)  NOT NULL,
    locale                     varchar(2)   NOT NULL,
    privacy_notice_accepted_at timestamptz  NOT NULL,
    email_verified_at          timestamptz,
    CONSTRAINT identity_user_role_check CHECK (role IN ('ARTIST', 'VENUE', 'BOOKER', 'ADMIN')),
    CONSTRAINT identity_user_status_check CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED')),
    CONSTRAINT identity_user_locale_check CHECK (locale IN ('pl', 'en'))
);

-- E-mails are stored lowercased by the application, so a plain unique index is enough.
CREATE UNIQUE INDEX identity_user_email_uidx ON identity_user (email);
CREATE INDEX identity_user_status_created_idx ON identity_user (status, created_at);

-- One-time tokens sent by e-mail (verification, password reset); only the SHA-256 hash is stored.
CREATE TABLE identity_token
(
    id         uuid        PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version    bigint      NOT NULL,
    user_id    uuid        NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    type       varchar(24) NOT NULL,
    token_hash varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    CONSTRAINT identity_token_type_check CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET'))
);

CREATE UNIQUE INDEX identity_token_hash_uidx ON identity_token (token_hash);
CREATE INDEX identity_token_user_type_idx ON identity_token (user_id, type);

-- Refresh tokens rotate on every use; all tokens descending from one login share a family.
CREATE TABLE identity_refresh_token
(
    id          uuid        PRIMARY KEY,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL,
    version     bigint      NOT NULL,
    user_id     uuid        NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    family_id   uuid        NOT NULL,
    token_hash  varchar(64) NOT NULL,
    expires_at  timestamptz NOT NULL,
    rotated_at  timestamptz,
    revoked_at  timestamptz
);

CREATE UNIQUE INDEX identity_refresh_token_hash_uidx ON identity_refresh_token (token_hash);
CREATE INDEX identity_refresh_token_family_idx ON identity_refresh_token (family_id);
CREATE INDEX identity_refresh_token_user_idx ON identity_refresh_token (user_id);
