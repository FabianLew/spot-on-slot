package pl.spotonslot.venue;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * A venue as moderation sees it, published or not, with its team. {@code hiddenAt}/{@code hiddenReason} are set while
 * an admin keeps it hidden.
 */
public record VenueModerationView(UUID id, String slug, String name, String city, boolean published,
        Instant hiddenAt, String hiddenReason, Set<UUID> team) {
}
