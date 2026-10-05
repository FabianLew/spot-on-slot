package pl.spotonslot.shared.error;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import pl.spotonslot.shared.i18n.LocaleConfig;

/**
 * Resolves localized error title and detail. Lookup order: {@code error.<code>.*}, then the generic code for the
 * HTTP status. A raw message key is never returned.
 */
@RequiredArgsConstructor
@Component
public class ErrorMessages {

    private static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private final MessageSource messageSource;

    public ErrorText resolve(String code, HttpStatus status, Object[] args, Locale locale) {
        var effectiveLocale = supported(locale);
        var effectiveArgs = args == null ? new Object[0] : args;
        var title = lookup(code, "title", effectiveArgs, effectiveLocale);
        var detail = lookup(code, "detail", effectiveArgs, effectiveLocale);
        if (title != null && detail != null) {
            return new ErrorText(title, detail);
        }
        var generic = genericCode(status);
        return new ErrorText(
                require(generic, "title", effectiveLocale),
                require(generic, "detail", effectiveLocale));
    }

    private String require(String code, String part, Locale locale) {
        var text = lookup(code, part, new Object[0], locale);
        return text != null ? text : lookup(INTERNAL_ERROR, part, new Object[0], locale);
    }

    private String lookup(String code, String part, Object[] args, Locale locale) {
        if (code == null) {
            return null;
        }
        try {
            return messageSource.getMessage("error." + code + "." + part, args, null, locale);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static Locale supported(Locale locale) {
        if (locale != null && LocaleConfig.ENGLISH.getLanguage().equals(locale.getLanguage())) {
            return LocaleConfig.ENGLISH;
        }
        return LocaleConfig.POLISH;
    }

    public static String genericCode(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "VALIDATION_FAILED";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case CONFLICT -> "CONFLICT";
            case UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case UNPROCESSABLE_ENTITY -> "BUSINESS_RULE_VIOLATED";
            default -> INTERNAL_ERROR;
        };
    }

    public record ErrorText(String title, String detail) {
    }
}
