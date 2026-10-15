-- B13: moderation. Admins block accounts, hide profiles and venues, close listings and work through reports.

-- Why and when an account was blocked (status BLOCKED); cleared on unblock.
ALTER TABLE identity_user
    ADD COLUMN blocked_at   timestamptz,
    ADD COLUMN block_reason varchar(500);

-- Hidden by moderation: unpublished, and the owner cannot publish again until an admin restores it.
ALTER TABLE artist_profile
    ADD COLUMN moderation_hidden_at timestamptz,
    ADD COLUMN moderation_reason    varchar(500);

ALTER TABLE venue
    ADD COLUMN moderation_hidden_at timestamptz,
    ADD COLUMN moderation_reason    varchar(500);

-- A listing closed by an admin keeps the reason for its author.
ALTER TABLE listing ADD COLUMN moderation_reason varchar(500);

-- One report of one thing by one person. Reports of the same thing (kind + target_id) are worked on together.
-- owner_ids: the accounts the reported thing belonged to when it was reported (artist, venue team, the other side
-- of a conversation); label: its name then. snapshot: for a conversation, the last messages the reporter saw.
CREATE TABLE moderation_report
(
    id              uuid          PRIMARY KEY,
    created_at      timestamptz   NOT NULL,
    updated_at      timestamptz   NOT NULL,
    version         bigint        NOT NULL,
    reporter_id     uuid,
    kind            varchar(16)   NOT NULL,
    target_id       uuid          NOT NULL,
    owner_ids       uuid[]        NOT NULL,
    label           varchar(120)  NOT NULL,
    reason          varchar(24)   NOT NULL,
    description     varchar(1000),
    snapshot        jsonb,
    status          varchar(16)   NOT NULL,
    resolved_at     timestamptz,
    resolved_by     uuid,
    resolution_note varchar(500),
    CONSTRAINT moderation_report_kind_check CHECK (kind IN ('ARTIST', 'VENUE', 'LISTING', 'CONVERSATION')),
    CONSTRAINT moderation_report_reason_check
        CHECK (reason IN ('SPAM', 'FRAUD', 'OFFENSIVE', 'IMPERSONATION', 'MISLEADING', 'OTHER')),
    CONSTRAINT moderation_report_status_check CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED'))
);

CREATE INDEX moderation_report_target_idx ON moderation_report (kind, target_id);
CREATE INDEX moderation_report_open_idx ON moderation_report (created_at) WHERE status = 'OPEN';
CREATE INDEX moderation_report_reporter_idx ON moderation_report (reporter_id, created_at);
CREATE INDEX moderation_report_owner_idx ON moderation_report USING gin (owner_ids);
-- One open report of a thing per person.
CREATE UNIQUE INDEX moderation_report_open_uidx ON moderation_report (reporter_id, kind, target_id)
    WHERE status = 'OPEN';

-- What admins did, never edited. subject_id: the account the action concerned (null when none);
-- subject_label: its e-mail or name then ("Usunięte konto" once purged).
CREATE TABLE moderation_action
(
    id            uuid         PRIMARY KEY,
    created_at    timestamptz  NOT NULL,
    updated_at    timestamptz  NOT NULL,
    version       bigint       NOT NULL,
    admin_id      uuid         NOT NULL,
    admin_email   varchar(254) NOT NULL,
    type          varchar(24)  NOT NULL,
    kind          varchar(16),
    target_id     uuid,
    subject_id    uuid,
    subject_label varchar(254) NOT NULL,
    reason        varchar(500),
    CONSTRAINT moderation_action_type_check CHECK (type IN ('BLOCK_ACCOUNT', 'UNBLOCK_ACCOUNT', 'HIDE', 'RESTORE',
        'CLOSE_LISTING', 'DISMISS_REPORTS', 'ADD_ADMIN'))
);

CREATE INDEX moderation_action_created_idx ON moderation_action (created_at);
CREATE INDEX moderation_action_subject_idx ON moderation_action (subject_id, created_at);
CREATE INDEX moderation_action_target_idx ON moderation_action (kind, target_id, created_at);
