-- Artists' free time (B7). owner_id is the artist account (no foreign key: modules own their tables).
-- Single slots are instants (UTC); weekly rules keep local times in their time zone and expand on read.
CREATE TABLE availability_slot
(
    id         uuid         PRIMARY KEY,
    created_at timestamptz  NOT NULL,
    updated_at timestamptz  NOT NULL,
    version    bigint       NOT NULL,
    owner_id   uuid         NOT NULL,
    starts_at  timestamptz  NOT NULL,
    ends_at    timestamptz  NOT NULL,
    status     varchar(16)  NOT NULL,
    note       varchar(200),
    booking_id uuid,
    CONSTRAINT availability_slot_range_ck CHECK (ends_at > starts_at)
);

CREATE INDEX availability_slot_owner_idx ON availability_slot (owner_id, starts_at);
CREATE UNIQUE INDEX availability_slot_booking_uq ON availability_slot (booking_id);

CREATE TABLE availability_rule
(
    id               uuid         PRIMARY KEY,
    created_at       timestamptz  NOT NULL,
    updated_at       timestamptz  NOT NULL,
    version          bigint       NOT NULL,
    owner_id         uuid         NOT NULL,
    start_time       time         NOT NULL,
    duration_minutes integer      NOT NULL,
    valid_from       date         NOT NULL,
    valid_until      date,
    time_zone        varchar(40)  NOT NULL,
    note             varchar(200)
);

CREATE INDEX availability_rule_owner_idx ON availability_rule (owner_id);

CREATE TABLE availability_rule_day
(
    rule_id     uuid        NOT NULL REFERENCES availability_rule (id) ON DELETE CASCADE,
    day_of_week varchar(9)  NOT NULL,
    PRIMARY KEY (rule_id, day_of_week)
);

-- Dates a rule leaves out (a day off, or a date that became a booked slot).
CREATE TABLE availability_rule_skip
(
    rule_id uuid NOT NULL REFERENCES availability_rule (id) ON DELETE CASCADE,
    day     date NOT NULL,
    PRIMARY KEY (rule_id, day)
);
