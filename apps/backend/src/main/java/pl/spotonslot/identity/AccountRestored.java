package pl.spotonslot.identity;

import java.util.UUID;

/** A deletion request was taken back within the grace period; the account is active again. */
public record AccountRestored(UUID userId) {
}
