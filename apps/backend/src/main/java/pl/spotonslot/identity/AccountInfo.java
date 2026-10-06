package pl.spotonslot.identity;

import java.util.UUID;

/** An account as other modules see it: who it is, never its credentials. */
public record AccountInfo(UUID id, String email, Role role, String locale) {
}
