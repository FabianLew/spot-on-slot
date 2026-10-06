package pl.spotonslot.media;

import java.util.UUID;

/** A stored image as other modules see it: its size and the public URLs of its WebP variants. */
public record MediaImage(UUID id, UUID ownerId, int width, int height, String small, String medium, String large) {
}
