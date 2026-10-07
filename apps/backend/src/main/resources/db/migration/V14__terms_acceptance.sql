-- Acceptance of the terms of service and privacy policy at registration. Accounts created before this have none.
ALTER TABLE identity_user
    ADD COLUMN terms_accepted_at timestamptz,
    ADD COLUMN terms_version     varchar(32);
