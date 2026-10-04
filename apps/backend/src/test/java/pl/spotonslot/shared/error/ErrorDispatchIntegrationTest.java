package pl.spotonslot.shared.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import pl.spotonslot.support.TestcontainersConfiguration;

/**
 * Errors the servlet container routes through its error dispatch ({@code /error}) — e.g. requests rejected by the
 * Spring Security firewall — must still be rendered as problem documents. Needs a real server: MockMvc does not perform
 * error dispatches.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ErrorDispatchIntegrationTest {

    @LocalServerPort
    int port;

    @Test
    void firewallRejectionIsProblem() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/system/info;x=1"))
                .header("X-Request-Id", "req-fw")
                .GET()
                .build();

        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(response.headers().firstValue("X-Request-Id")).hasValue("req-fw");
        assertThat(response.body())
                .contains("\"code\":\"VALIDATION_FAILED\"")
                .contains("\"requestId\":\"req-fw\"")
                .contains("\"instance\":\"/api/v1/system/info;x=1\"")
                .contains("\"title\":\"Nieprawidłowe dane\"");
    }
}
