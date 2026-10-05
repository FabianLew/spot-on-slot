package pl.spotonslot.identity.application;

import java.time.Duration;

/** Result of a login or refresh: the access token for the response body and the refresh token for the cookie. */
public record SessionTokens(String accessToken, Duration accessTokenTtl, String refreshToken, Duration refreshTokenTtl) {
}
