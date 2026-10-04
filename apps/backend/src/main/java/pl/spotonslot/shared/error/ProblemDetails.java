package pl.spotonslot.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import pl.spotonslot.shared.error.ErrorMessages.ErrorText;
import pl.spotonslot.shared.web.RequestIdFilter;

/** Builds RFC 9457 problem documents with the project's extension properties. */
final class ProblemDetails {

    private ProblemDetails() {
    }

    static ProblemDetail of(HttpStatus status, String code, ErrorText text, HttpServletRequest request) {
        return of(status, code, text, request.getRequestURI());
    }

    /** Builds a problem whose {@code instance} is the given path, e.g. the original URI of an error dispatch. */
    static ProblemDetail of(HttpStatus status, String code, ErrorText text, String path) {
        var problem = ProblemDetail.forStatusAndDetail(status, text.detail());
        problem.setTitle(text.title());
        problem.setInstance(instance(path));
        problem.setProperty("code", code);
        var requestId = MDC.get(RequestIdFilter.MDC_KEY);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        return problem;
    }

    private static URI instance(String path) {
        if (path == null) {
            return URI.create("/");
        }
        try {
            return URI.create(path);
        } catch (IllegalArgumentException e) {
            return URI.create("/");
        }
    }
}
