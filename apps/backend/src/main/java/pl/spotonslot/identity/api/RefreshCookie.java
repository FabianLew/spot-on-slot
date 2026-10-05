package pl.spotonslot.identity.api;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.IdentityProperties;

/** The refresh token cookie: HttpOnly, SameSite=Lax, sent only to the auth endpoints. */
@Component
@RequiredArgsConstructor
class RefreshCookie {

    static final String NAME = "sos_refresh";
    static final String PATH = "/api/v1/auth";

    private final IdentityProperties properties;

    ResponseCookie issue(String token, Duration ttl) {
        return builder(token).maxAge(ttl).build();
    }

    ResponseCookie clear() {
        return builder("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder builder(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(properties.cookieSecure())
                .sameSite("Lax")
                .path(PATH);
    }
}
