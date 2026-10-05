CREATE TABLE waitlist_signup
(
    id               uuid         PRIMARY KEY,
    created_at       timestamptz  NOT NULL,
    updated_at       timestamptz  NOT NULL,
    version          bigint       NOT NULL,
    email            varchar(254) NOT NULL,
    role             varchar(16)  NOT NULL,
    city             varchar(100) NOT NULL,
    locale           varchar(2)   NOT NULL,
    status           varchar(16)  NOT NULL,
    token_hash       varchar(64)  NOT NULL,
    token_expires_at timestamptz  NOT NULL,
    token_sent_at    timestamptz  NOT NULL,
    consent_at       timestamptz  NOT NULL,
    confirmed_at     timestamptz,
    CONSTRAINT waitlist_signup_role_check CHECK (role IN ('ARTIST', 'BOOKER', 'VENUE')),
    CONSTRAINT waitlist_signup_locale_check CHECK (locale IN ('pl', 'en')),
    CONSTRAINT waitlist_signup_status_check CHECK (status IN ('PENDING', 'CONFIRMED'))
);

-- E-mails are stored lowercased by the application, so a plain unique index is enough.
CREATE UNIQUE INDEX waitlist_signup_email_uidx ON waitlist_signup (email);
CREATE UNIQUE INDEX waitlist_signup_token_hash_uidx ON waitlist_signup (token_hash);
