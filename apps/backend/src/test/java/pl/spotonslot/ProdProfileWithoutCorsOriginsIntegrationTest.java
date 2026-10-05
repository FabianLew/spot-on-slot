package pl.spotonslot;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.spotonslot.shared.web.CorsProperties;
import pl.spotonslot.support.IntegrationTest;

/** Without {@code CORS_ALLOWED_ORIGINS} the prod profile still starts and allows no cross-origin caller. */
@IntegrationTest
@ActiveProfiles({"test", "prod"})
@TestPropertySource(properties = {
    "MAIL_HOST=smtp.example.com",
    "MAIL_FROM=no-reply@spotonslot.pl",
    "LANDING_BASE_URL=https://spotonslot.pl"
})
class ProdProfileWithoutCorsOriginsIntegrationTest {

    @Autowired
    CorsProperties corsProperties;

    @Test
    void startsWithNoAllowedOrigins() {
        assertThat(corsProperties.allowedOrigins()).isEmpty();
    }
}
