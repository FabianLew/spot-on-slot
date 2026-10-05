package pl.spotonslot.location.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.domain.Area;
import pl.spotonslot.location.domain.LocationErrors;
import pl.spotonslot.location.domain.Place;

class PhotonGeocoderTest {

    private static final Locale PL = Locale.forLanguageTag("pl");

    private MockRestServiceServer server;
    private PhotonGeocoder geocoder;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl("http://photon.test");
        server = MockRestServiceServer.bindTo(builder).build();
        geocoder = new PhotonGeocoder(builder.build(), "SpotOnSlot-test", 5, new GeoPoint(52.0, 19.0));
    }

    @Test
    void searchMapsPlacesWithPolishNamesAndBiasTowardsPoland() throws IOException {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("http://photon.test/api")))
                .andExpect(queryParam("q", "krak"))
                .andExpect(queryParam("limit", "5"))
                .andExpect(queryParam("lang", "default"))
                .andExpect(queryParam("lat", "52.0"))
                .andExpect(queryParam("lon", "19.0"))
                .andExpect(header("User-Agent", "SpotOnSlot-test"))
                .andRespond(withSuccess(fixture("search-krakow.json"), MediaType.APPLICATION_JSON));

        var places = geocoder.search("krak", PL);

        assertThat(places).containsExactly(
                new Place("Kraków, małopolskie", "Kraków", "małopolskie", "PL", new GeoPoint(50.0619474, 19.9368564)),
                new Place("Rynek Główny 1, Kraków", "Kraków", "małopolskie", "PL", new GeoPoint(50.0617, 19.9372)),
                new Place("Krakowska, Kraków", "Kraków", "małopolskie", "PL", new GeoPoint(50.05, 19.95)));
    }

    @Test
    void searchAsksForEnglishNamesInEnglish() throws IOException {
        server.expect(queryParam("lang", "en"))
                .andRespond(withSuccess(fixture("reverse-sea.json"), MediaType.APPLICATION_JSON));

        assertThat(geocoder.search("krak", Locale.ENGLISH)).isEmpty();
    }

    @Test
    void reverseTakesTheCityOfTheNearestObject() throws IOException {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("http://photon.test/reverse")))
                .andExpect(queryParam("lat", "50.06"))
                .andExpect(queryParam("lon", "19.94"))
                .andExpect(queryParam("lang", "default"))
                .andRespond(withSuccess(fixture("reverse-krakow.json"), MediaType.APPLICATION_JSON));

        assertThat(geocoder.reverse(new GeoPoint(50.06, 19.94), PL))
                .contains(new Area("Kraków", "małopolskie", "PL"));
    }

    @Test
    void reverseOnAPlaceUsesItsOwnName() throws IOException {
        server.expect(queryParam("lang", "en"))
                .andRespond(withSuccess(fixture("reverse-village.json"), MediaType.APPLICATION_JSON));

        assertThat(geocoder.reverse(new GeoPoint(50.3, 19.5), Locale.ENGLISH))
                .contains(new Area("Wolbrom", "Lesser Poland Voivodeship", "PL"));
    }

    @Test
    void reverseWithoutResultsIsEmpty() throws IOException {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("http://photon.test/reverse")))
                .andRespond(withSuccess(fixture("reverse-sea.json"), MediaType.APPLICATION_JSON));

        assertThat(geocoder.reverse(new GeoPoint(55.0, 18.0), PL)).isEmpty();
    }

    @Test
    void serverErrorMeansUnavailable() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("http://photon.test/api"))).andRespond(withServerError());

        assertThatThrownBy(() -> geocoder.search("krak", PL)).isInstanceOf(LocationErrors.GeocoderUnavailable.class);
    }

    @Test
    void ioFailureMeansUnavailable() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("http://photon.test/reverse"))).andRespond(request -> {
            throw new SocketTimeoutException("read timed out");
        });

        assertThatThrownBy(() -> geocoder.reverse(new GeoPoint(50.0, 19.0), PL))
                .isInstanceOf(LocationErrors.GeocoderUnavailable.class);
    }

    private static String fixture(String name) throws IOException {
        return new ClassPathResource("photon/" + name).getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    }
}
