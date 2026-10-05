package pl.spotonslot.identity.application;

import java.util.Locale;

final class Emails {

    private Emails() {
    }

    /** Addresses are compared and stored trimmed and lowercased. */
    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
