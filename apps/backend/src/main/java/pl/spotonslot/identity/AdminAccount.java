package pl.spotonslot.identity;

import java.time.Instant;
import java.util.UUID;

/**
 * An account as the admin panel shows it. {@code lastSignInAt} is the latest session start (login or refresh), null
 * when it never signed in; {@code blockedAt}/{@code blockReason} are set while blocked.
 */
public record AdminAccount(UUID id, String email, Role role, AccountState state, Instant createdAt,
        Instant lastSignInAt, Instant blockedAt, String blockReason, Instant deletionRequestedAt) {
}
