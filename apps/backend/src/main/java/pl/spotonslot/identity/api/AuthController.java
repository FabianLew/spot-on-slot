package pl.spotonslot.identity.api;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.identity.application.AccountService;
import pl.spotonslot.identity.application.AccountSettingsService;
import pl.spotonslot.identity.application.PasswordResetService;
import pl.spotonslot.identity.application.SessionService;
import pl.spotonslot.identity.application.SessionTokens;
import pl.spotonslot.identity.domain.IdentityErrors;

/**
 * Account and session endpoints. Links from e-mails are confirmed with POST, so mail scanners that open links cannot
 * use them by accident. Endpoints that take an e-mail address always answer 202 with no body.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
class AuthController {

    private final AccountService accounts;
    private final SessionService sessions;
    private final PasswordResetService passwordReset;
    private final RefreshCookie refreshCookie;
    private final AccountSettingsService accountSettings;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void register(@Valid @RequestBody RegisterRequest request) {
        accounts.register(request.toCommand());
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void verifyEmail(@Valid @RequestBody TokenRequest request) {
        accounts.verifyEmail(request.token());
    }

    @PostMapping("/verify-email/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void resendVerification(@Valid @RequestBody EmailRequest request) {
        accounts.resendVerification(request.email());
    }

    @PostMapping("/login")
    ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return withSession(sessions.login(request.email(), request.password()));
    }

    @PostMapping("/refresh")
    ResponseEntity<AccessTokenResponse> refresh(
            @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken,
            HttpServletResponse response) {
        try {
            return withSession(sessions.refresh(refreshToken));
        } catch (IdentityErrors.RefreshInvalid e) {
            // Drop a cookie that no longer works, so the browser stops sending it; the problem response keeps it.
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.clear().toString());
            throw e;
        }
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(@CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken) {
        sessions.logout(refreshToken);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, refreshCookie.clear().toString()).build();
    }

    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void requestPasswordReset(@Valid @RequestBody EmailRequest request) {
        passwordReset.request(request.email());
    }

    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordReset.confirm(request.token(), request.password());
    }

    /** Confirms a new e-mail address from the link sent to it; 409 {@code IDENTITY_EMAIL_TAKEN} if taken meanwhile. */
    @PostMapping("/email-change/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void confirmEmailChange(@Valid @RequestBody TokenRequest request) {
        accountSettings.confirmEmailChange(request.token());
    }

    private ResponseEntity<AccessTokenResponse> withSession(SessionTokens tokens) {
        var body = new AccessTokenResponse(tokens.accessToken(), "Bearer", tokens.accessTokenTtl().toSeconds());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.issue(tokens.refreshToken(), tokens.refreshTokenTtl())
                        .toString())
                .body(body);
    }
}
