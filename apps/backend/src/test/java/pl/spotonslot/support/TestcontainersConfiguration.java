package pl.spotonslot.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    private static final DockerImageName POSTGIS = DockerImageName.parse("postgis/postgis:16-3.5")
            .asCompatibleSubstituteFor("postgres");
    private static final DockerImageName S3MOCK = DockerImageName.parse("adobe/s3mock:5.2.3");
    public static final String MEDIA_BUCKET = "spotonslot-media";

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(POSTGIS);
    }

    /** S3-compatible storage for the media module; any credentials are accepted. */
    @Bean
    GenericContainer<?> s3MockContainer() {
        return new GenericContainer<>(S3MOCK)
                .withEnv("COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS", MEDIA_BUCKET)
                .withExposedPorts(9090)
                .waitingFor(Wait.forHttp("/").forPort(9090));
    }

    @Bean
    DynamicPropertyRegistrar s3MockProperties(GenericContainer<?> s3MockContainer) {
        return registry -> {
            var endpoint = "http://" + s3MockContainer.getHost() + ":" + s3MockContainer.getMappedPort(9090);
            registry.add("spotonslot.media.endpoint", () -> endpoint);
            registry.add("spotonslot.media.bucket", () -> MEDIA_BUCKET);
            registry.add("spotonslot.media.public-base-url", () -> endpoint + "/" + MEDIA_BUCKET);
        };
    }
}
