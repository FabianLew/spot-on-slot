package pl.spotonslot.identity.application;

import pl.spotonslot.identity.Role;

public record RegisterCommand(String email, String password, Role role, String locale) {
}
