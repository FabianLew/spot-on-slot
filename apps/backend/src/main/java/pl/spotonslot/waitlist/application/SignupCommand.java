package pl.spotonslot.waitlist.application;

import pl.spotonslot.waitlist.domain.WaitlistRole;

/**
 * A validated sign-up request. {@code website} is the honeypot field: real users leave it empty.
 */
public record SignupCommand(String email, WaitlistRole role, String city, String locale, String website) {
}
