package pl.spotonslot.artist;

import java.time.Instant;
import java.util.UUID;

/**
 * A profile as moderation sees it, published or not. {@code hiddenAt}/{@code hiddenReason} are set while an admin
 * keeps it hidden.
 */
public record ArtistModerationView(UUID profileId, UUID ownerId, String slug, String stageName, boolean published,
        Instant hiddenAt, String hiddenReason) {
}
