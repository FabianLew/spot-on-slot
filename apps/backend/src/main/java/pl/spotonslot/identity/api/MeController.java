package pl.spotonslot.identity.api;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.api.AccountDtos.ChangeEmailRequest;
import pl.spotonslot.identity.api.AccountDtos.ChangePasswordRequest;
import pl.spotonslot.identity.api.AccountDtos.DeletionBlockerResponse;
import pl.spotonslot.identity.api.AccountDtos.DeletionCheckResponse;
import pl.spotonslot.identity.api.AccountDtos.DeletionRequest;
import pl.spotonslot.identity.api.AccountDtos.DeletionScheduledResponse;
import pl.spotonslot.identity.application.AccountQueries;
import pl.spotonslot.identity.application.AccountSettingsService;
import pl.spotonslot.identity.infrastructure.AccessTokenIssuer;

/**
 * The signed-in account and its settings. Changes that need the current password answer a wrong one with 400
 * {@code IDENTITY_WRONG_PASSWORD} at the password field, and five wrong ones within 15 minutes with 429
 * {@code ACCOUNT_TOO_MANY_ATTEMPTS}.
 */
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
class MeController {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final AccountQueries queries;
    private final AccountSettingsService settings;
    private final IdentityProperties properties;

    /** The signed-in account. */
    @GetMapping
    MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        var account = queries.get(user(jwt));
        return new MeResponse(account.getId(), account.getEmail(), account.getRole(), account.getLocale(),
                settings.termsAccepted(account), settings.termsVersion(), settings.deletionScheduledAt(account));
    }

    /** Changes the password; every other device is signed out, this session stays. */
    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChangePasswordRequest request) {
        settings.changePassword(user(jwt), session(jwt), request.currentPassword(), request.newPassword());
    }

    /**
     * Sends a confirmation link (valid 24 h) to the new address; the address changes once it is opened
     * ({@code POST /api/v1/auth/email-change/confirm}). Always 202, whether or not the new address has an account.
     */
    @PostMapping("/email-change")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void requestEmailChange(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChangeEmailRequest request) {
        settings.requestEmailChange(user(jwt), request.newEmail(), request.currentPassword());
    }

    /** Accepts the current version of the terms of service and privacy policy. */
    @PostMapping("/terms")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void acceptTerms(@AuthenticationPrincipal Jwt jwt) {
        settings.acceptTerms(user(jwt));
    }

    /**
     * Everything stored about the account as a JSON file, one section per module; at most once a minute (429
     * {@code ACCOUNT_EXPORT_TOO_SOON}).
     */
    @GetMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Map<String, Object>> export(@AuthenticationPrincipal Jwt jwt) {
        var body = settings.export(user(jwt));
        var filename = "spot-on-slot-dane-" + LocalDate.now(WARSAW) + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    /** Whether the account can be deleted now, and what stops it (venues that would lose their last owner). */
    @GetMapping("/deletion")
    DeletionCheckResponse deletionCheck(@AuthenticationPrincipal Jwt jwt) {
        return new DeletionCheckResponse(settings.deletionBlockers(user(jwt)).stream()
                .map(DeletionBlockerResponse::of).toList(), properties.deletionGrace().toDays());
    }

    /**
     * Schedules the account for deletion: signed out everywhere, hidden from others, purged after the grace period
     * unless restored. 409 {@code ACCOUNT_LAST_VENUE_OWNER} while {@code GET /deletion} lists blockers.
     */
    @PostMapping("/deletion")
    @ResponseStatus(HttpStatus.ACCEPTED)
    DeletionScheduledResponse requestDeletion(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody DeletionRequest request) {
        return new DeletionScheduledResponse(settings.requestDeletion(user(jwt), request.password()));
    }

    /**
     * Restores an account waiting for deletion. Refresh the session afterwards ({@code POST /api/v1/auth/refresh})
     * for a fresh access token; doing nothing for an account that is not waiting is not an error.
     */
    @PostMapping("/deletion/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancelDeletion(@AuthenticationPrincipal Jwt jwt) {
        settings.cancelDeletion(user(jwt));
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** The refresh token family the access token came from; null for tokens without it. */
    private static UUID session(Jwt jwt) {
        var sid = jwt.getClaimAsString(AccessTokenIssuer.SESSION_CLAIM);
        try {
            return sid == null ? null : UUID.fromString(sid);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
