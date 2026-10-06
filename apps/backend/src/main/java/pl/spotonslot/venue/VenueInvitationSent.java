package pl.spotonslot.venue;

import java.time.Instant;

/**
 * Someone was invited to a venue's team: send {@code token} to {@code email} in {@code locale}. The token is the raw
 * value; only its hash is stored.
 */
public record VenueInvitationSent(String email, String locale, String token, String venueName, VenueRole role,
        Instant expiresAt) {
}
