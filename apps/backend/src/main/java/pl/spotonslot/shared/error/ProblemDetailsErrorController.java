package pl.spotonslot.shared.error;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.LocaleResolver;

/**
 * Replaces Boot's {@code BasicErrorController}: errors the servlet container routes through its error dispatch (e.g.
 * requests rejected by the Spring Security firewall, {@code sendError} calls outside MVC) are rendered as problem
 * documents too. Never exposes the original exception.
 */
@Hidden
@RestController
class ProblemDetailsErrorController implements ErrorController {

    private final ErrorMessages errorMessages;
    private final LocaleResolver localeResolver;

    ProblemDetailsErrorController(ErrorMessages errorMessages, LocaleResolver localeResolver) {
        this.errorMessages = errorMessages;
        this.localeResolver = localeResolver;
    }

    @RequestMapping("${server.error.path:${error.path:/error}}")
    ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
        var status = status(request);
        var code = ErrorMessages.genericCode(status);
        var text = errorMessages.resolve(code, status, null, localeResolver.resolveLocale(request));
        var path = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI) instanceof String uri
                ? uri
                : request.getRequestURI();
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ProblemDetails.of(status, code, text, path));
    }

    private static HttpStatus status(HttpServletRequest request) {
        if (request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE) instanceof Integer code) {
            var status = HttpStatus.resolve(code);
            if (status != null) {
                return status;
            }
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
