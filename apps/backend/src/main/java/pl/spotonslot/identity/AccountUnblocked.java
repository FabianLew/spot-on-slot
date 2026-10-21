package pl.spotonslot.identity;

import java.util.UUID;

/** An admin lifted a block; what was hidden stays unpublished until the owner publishes it again. */
public record AccountUnblocked(UUID userId) {
}
