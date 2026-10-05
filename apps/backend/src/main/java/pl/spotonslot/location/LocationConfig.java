package pl.spotonslot.location;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import pl.spotonslot.location.application.Geocoder;
import pl.spotonslot.location.infrastructure.PhotonGeocoder;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(LocationProperties.class)
class LocationConfig {

    @Bean
    Geocoder geocoder(RestClient.Builder builder, LocationProperties properties) {
        var http = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        var requestFactory = new JdkClientHttpRequestFactory(http);
        requestFactory.setReadTimeout(properties.readTimeout());
        var restClient = builder.clone()
                .baseUrl(properties.geocoderUrl())
                .requestFactory(requestFactory)
                .build();
        return new PhotonGeocoder(restClient, properties.userAgent(), properties.suggestionLimit(),
                new GeoPoint(properties.biasLatitude(), properties.biasLongitude()));
    }
}
