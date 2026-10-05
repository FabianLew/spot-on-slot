package pl.spotonslot.identity.api;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.identity.application.AccountQueries;

@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
class MeController {

    private final AccountQueries queries;

    /** The signed-in account. */
    @GetMapping
    MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        var account = queries.get(UUID.fromString(jwt.getSubject()));
        return new MeResponse(account.getId(), account.getEmail(), account.getRole(), account.getLocale());
    }
}
