package pl.spotonslot.identity;

import java.util.UUID;

/** A new account was created (still unverified). Profile modules can prepare their data for it. */
public record UserRegistered(UUID userId, Role role) {
}
