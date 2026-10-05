package pl.spotonslot.notification;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class NotificationPropertiesTest {

    @Test
    void stripsTrailingSlashFromLandingBaseUrl() {
        assertThat(new NotificationProperties.Landing("https://spotonslot.pl/").baseUrl())
                .isEqualTo("https://spotonslot.pl");
        assertThat(new NotificationProperties.Landing("https://spotonslot.pl").baseUrl())
                .isEqualTo("https://spotonslot.pl");
    }
}
