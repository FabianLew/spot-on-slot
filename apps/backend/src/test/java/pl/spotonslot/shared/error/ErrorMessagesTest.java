package pl.spotonslot.shared.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.LocaleResolver;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class ErrorMessagesTest {

    private static final Locale PL = Locale.forLanguageTag("pl");
    private static final Object[] NO_ARGS = new Object[0];

    @Autowired
    ErrorMessages errorMessages;

    @Autowired
    LocaleResolver localeResolver;

    @Test
    void resolvesPolishByDefault() {
        var text = errorMessages.resolve("NOT_FOUND", HttpStatus.NOT_FOUND, NO_ARGS, PL);

        assertThat(text.title()).isEqualTo("Nie znaleziono");
    }

    @Test
    void resolvesEnglish() {
        var text = errorMessages.resolve("NOT_FOUND", HttpStatus.NOT_FOUND, NO_ARGS, Locale.ENGLISH);

        assertThat(text.title()).isEqualTo("Not found");
    }

    @Test
    void fallsBackToGenericForUnknownModuleCode() {
        var generic = errorMessages.resolve("NOT_FOUND", HttpStatus.NOT_FOUND, NO_ARGS, PL);

        var text = errorMessages.resolve("ARTIST_NOT_FOUND", HttpStatus.NOT_FOUND, NO_ARGS, PL);

        assertThat(text).isEqualTo(generic);
    }

    @Test
    void fallsBackToPolishForUnsupportedLocale() {
        var text = errorMessages.resolve("NOT_FOUND", HttpStatus.NOT_FOUND, NO_ARGS, Locale.GERMAN);

        assertThat(text.title()).isEqualTo("Nie znaleziono");
    }

    @Test
    void unmappedStatusFallsBackToInternalError() {
        var text = errorMessages.resolve("SOMETHING_ODD", HttpStatus.BAD_GATEWAY, NO_ARGS, PL);

        assertThat(text.title()).isEqualTo("Błąd serwera");
    }

    @Test
    void everyDocumentedCodeHasTextInBothLocales() {
        var codes = new String[] {
            "VALIDATION_FAILED", "MALFORMED_REQUEST", "INVALID_SORT", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
            "METHOD_NOT_ALLOWED", "CONFLICT", "CONCURRENT_MODIFICATION", "UNSUPPORTED_MEDIA_TYPE",
            "BUSINESS_RULE_VIOLATED", "INTERNAL_ERROR"
        };
        for (var code : codes) {
            for (var locale : new Locale[] {PL, Locale.ENGLISH}) {
                var text = errorMessages.resolve(code, HttpStatus.INTERNAL_SERVER_ERROR, NO_ARGS, locale);
                assertThat(text.title()).as(code + " title " + locale).isNotBlank().doesNotContain("error.");
                assertThat(text.detail()).as(code + " detail " + locale).isNotBlank().doesNotContain("error.");
            }
        }
    }

    @Test
    void localeResolverHandlesWildcardAndUnsupported() {
        for (var header : new String[] {"*", "de", "xx-YY;q=abc", ""}) {
            var request = new MockHttpServletRequest();
            request.addHeader("Accept-Language", header);

            assertThat(localeResolver.resolveLocale(request).getLanguage()).as(header).isEqualTo("pl");
        }
    }

    @Test
    void localeResolverHonoursEnglish() {
        var request = new MockHttpServletRequest();
        request.addHeader("Accept-Language", "en-GB,en;q=0.8");

        assertThat(localeResolver.resolveLocale(request).getLanguage()).isEqualTo("en");
    }
}
