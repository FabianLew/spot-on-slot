package pl.spotonslot.media;

import java.util.UUID;

/** Published after an image was deleted, so modules referencing it (profiles) can drop the reference. */
public record MediaDeleted(UUID mediaId, UUID ownerId) {
}
