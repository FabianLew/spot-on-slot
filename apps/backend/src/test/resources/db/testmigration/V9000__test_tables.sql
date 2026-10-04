CREATE TABLE test_note (
    id         uuid         PRIMARY KEY,
    title      varchar(200) NOT NULL,
    created_at timestamptz  NOT NULL,
    updated_at timestamptz  NOT NULL,
    version    bigint       NOT NULL
);
