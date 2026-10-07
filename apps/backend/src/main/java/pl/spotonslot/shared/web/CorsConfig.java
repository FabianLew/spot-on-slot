package pl.spotonslot.shared.web;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class CorsConfig {

    private static final List<String> ALLOWED_METHODS = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
    private static final Duration MAX_AGE = Duration.ofSeconds(3600);

    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        var configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.allowedOrigins());
        configuration.setAllowedMethods(ALLOWED_METHODS);
        configuration.setAllowedHeaders(List.of(CorsConfiguration.ALL));
        configuration.setExposedHeaders(List.of(RequestIdFilter.HEADER, HttpHeaders.CONTENT_DISPOSITION));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(MAX_AGE);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
