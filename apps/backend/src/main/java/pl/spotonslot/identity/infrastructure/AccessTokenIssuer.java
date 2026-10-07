package pl.spotonslot.identity.infrastructure;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.domain.UserAccount;

/**
 * Signs short-lived access tokens: {@code sub} = account id, {@code role} = account role, {@code sid} = the session
 * (refresh token family) it came from, so account changes can end every other session.
 */
@Component
@RequiredArgsConstructor
public class AccessTokenIssuer {

    private final JwtEncoder encoder;
    private final IdentityProperties properties;

    public static final String SESSION_CLAIM = "sid";

    public String issue(UserAccount account, UUID sessionId, Instant now) {
        var claims = JwtClaimsSet.builder()
                .issuer(properties.jwtIssuer())
                .subject(account.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(properties.accessTokenTtl()))
                .claim("role", account.getRole().name())
                .claim(SESSION_CLAIM, sessionId.toString())
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public Duration ttl() {
        return properties.accessTokenTtl();
    }
}
