package pl.spotonslot.shared.i18n;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Resolves the request locale from {@code Accept-Language}; only Polish and English are supported, Polish is the default.
 */
@Configuration(proxyBeanMethods = false)
public class LocaleConfig {

    public static final Locale POLISH = Locale.forLanguageTag("pl");
    public static final Locale ENGLISH = Locale.forLanguageTag("en");

    private static final List<Locale> SUPPORTED = List.of(POLISH, ENGLISH);

    @Bean
    public LocaleResolver localeResolver() {
        var resolver = new SupportedLocaleResolver();
        resolver.setSupportedLocales(SUPPORTED);
        resolver.setDefaultLocale(POLISH);
        return resolver;
    }

    /**
     * Parses the header itself so that a wildcard, an unsupported language or a malformed value falls back to Polish
     * instead of the container's (JVM default) locale.
     */
    private static final class SupportedLocaleResolver extends AcceptHeaderLocaleResolver {

        @Override
        public Locale resolveLocale(HttpServletRequest request) {
            var header = request.getHeader("Accept-Language");
            if (header == null || header.isBlank()) {
                return POLISH;
            }
            try {
                var match = Locale.lookup(Locale.LanguageRange.parse(header), SUPPORTED);
                return match != null ? match : POLISH;
            } catch (IllegalArgumentException e) {
                return POLISH;
            }
        }
    }
}
