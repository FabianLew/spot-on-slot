package pl.spotonslot.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.support.RequestContextUtils;

/**
 * Renders every error as an RFC 9457 problem document ({@code application/problem+json}) with a stable {@code code},
 * localized {@code title}/{@code detail}, and the request id. Unexpected exceptions never leak their message.
 */
@RestControllerAdvice
public class ProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsExceptionHandler.class);

    private final ErrorMessages errorMessages;
    private final MessageSource messageSource;

    public ProblemDetailsExceptionHandler(ErrorMessages errorMessages, MessageSource messageSource) {
        this.errorMessages = errorMessages;
        this.messageSource = messageSource;
    }

    @ExceptionHandler(DomainException.class)
    ResponseEntity<Object> handleDomain(DomainException ex, WebRequest request) {
        return respond(ex, ex.status(), ex.code(), ex.detailArgs(), List.of(), new HttpHeaders(), request);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<Object> handleOptimisticLock(OptimisticLockingFailureException ex, WebRequest request) {
        return respond(ex, HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION", null, List.of(), new HttpHeaders(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        return respond(ex, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", null, List.of(), new HttpHeaders(),
                request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        var status = toStatus(statusCode);
        var errors = new ArrayList<Map<String, String>>();
        String code;
        if (ex instanceof MethodArgumentNotValidException invalid) {
            code = "VALIDATION_FAILED";
            invalid.getBindingResult().getFieldErrors().forEach(error -> errors.add(fieldError(error, request)));
        } else if (ex instanceof HandlerMethodValidationException invalid) {
            code = "VALIDATION_FAILED";
            invalid.getParameterValidationResults().forEach(result -> result.getResolvableErrors().forEach(error ->
                    errors.add(parameterError(result.getMethodParameter().getParameterName(), error, request))));
        } else if (ex instanceof HttpMessageNotReadableException) {
            code = "MALFORMED_REQUEST";
        } else {
            code = genericCode(status);
        }
        return respond(ex, status, code, null, errors, headers, request);
    }

    private ResponseEntity<Object> respond(Exception ex, HttpStatus status, String code, Object[] args,
            List<Map<String, String>> errors, HttpHeaders headers, WebRequest request) {
        var servletRequest = ((ServletWebRequest) request).getRequest();
        var locale = RequestContextUtils.getLocale(servletRequest);
        var problem = ProblemDetails.of(status, code, errorMessages.resolve(code, status, args, locale), servletRequest);
        if (!errors.isEmpty()) {
            problem.setProperty("errors", errors);
        }
        log(ex, status, servletRequest);
        return super.handleExceptionInternal(ex, problem, headers, status, request);
    }

    private static void log(Exception ex, HttpStatus status, HttpServletRequest request) {
        if (status.is5xxServerError()) {
            log.error("Request {} {} failed", request.getMethod(), request.getRequestURI(), ex);
        } else if (log.isDebugEnabled()) {
            log.debug("Request {} {} rejected with {}", request.getMethod(), request.getRequestURI(), status.value(), ex);
        }
    }

    private Map<String, String> fieldError(FieldError error, WebRequest request) {
        return Map.of(
                "field", error.getField(),
                "code", String.valueOf(error.getCode()),
                "message", message(error, request));
    }

    private Map<String, String> parameterError(String parameter, MessageSourceResolvable error, WebRequest request) {
        var codes = error.getCodes();
        // The last code is the bare constraint name, e.g. "Size".
        var code = codes == null || codes.length == 0 ? "Invalid" : codes[codes.length - 1];
        return Map.of(
                "field", parameter == null ? "" : parameter,
                "code", code,
                "message", message(error, request));
    }

    private String message(MessageSourceResolvable error, WebRequest request) {
        var locale = RequestContextUtils.getLocale(((ServletWebRequest) request).getRequest());
        return messageSource.getMessage(error, locale);
    }

    private static HttpStatus toStatus(HttpStatusCode code) {
        var status = HttpStatus.resolve(code.value());
        return status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private static String genericCode(HttpStatus status) {
        return switch (status) {
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case CONFLICT -> "CONFLICT";
            case UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case UNPROCESSABLE_ENTITY -> "BUSINESS_RULE_VIOLATED";
            default -> status.is5xxServerError() ? "INTERNAL_ERROR" : "MALFORMED_REQUEST";
        };
    }
}
