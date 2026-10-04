package pl.spotonslot.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import pl.spotonslot.shared.error.ErrorMessages.ErrorText;

/** Builds RFC 9457 problem documents with the project's extension properties. */
final class ProblemDetails {

    static final String REQUEST_ID_KEY = "requestId";

    private ProblemDetails() {
    }

    static ProblemDetail of(HttpStatus status, String code, ErrorText text, HttpServletRequest request) {
        var problem = ProblemDetail.forStatusAndDetail(status, text.detail());
        problem.setTitle(text.title());
        problem.setInstance(instance(request));
        problem.setProperty("code", code);
        var requestId = MDC.get(REQUEST_ID_KEY);
        if (requestId != null) {
            problem.setProperty(REQUEST_ID_KEY, requestId);
        }
        return problem;
    }

    private static URI instance(HttpServletRequest request) {
        var path = request.getRequestURI();
        try {
            return URI.create(path);
        } catch (IllegalArgumentException e) {
            return URI.create("/");
        }
    }
}
