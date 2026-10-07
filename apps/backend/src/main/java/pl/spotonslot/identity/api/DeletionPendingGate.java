package pl.spotonslot.identity.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/**
 * An account waiting for deletion can sign in (to restore it) but use nothing else: every API call with its token
 * answers 403 {@code ACCOUNT_DELETION_PENDING}, except {@code GET /api/v1/me}, {@code POST /api/v1/me/deletion/cancel}
 * and the public and auth endpoints (refresh, logout). The status is read per request (one primary-key lookup), so
 * a restore works at once and tokens issued before the request stop working too.
 */
@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
class DeletionPendingGate implements WebMvcConfigurer, HandlerInterceptor {

    private static final String ME = "/api/v1/me";

    private final UserAccountRepository accounts;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/v1/auth/**", "/api/v1/public/**", "/api/v1/system/**",
                        "/api/v1/waitlist/**", ME + "/deletion/cancel");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken token)) {
            return true;
        }
        if (HttpMethod.GET.matches(request.getMethod()) && ME.equals(request.getRequestURI())) {
            return true;
        }
        UUID userId;
        try {
            userId = UUID.fromString(token.getToken().getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            return true;
        }
        if (accounts.existsByIdAndStatus(userId, AccountStatus.DELETION_PENDING)) {
            throw new IdentityErrors.DeletionPending();
        }
        return true;
    }
}
