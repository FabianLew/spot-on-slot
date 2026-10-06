package pl.spotonslot.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.location.application.LocationService;
import pl.spotonslot.location.domain.LocationSource;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.support.PhotonStub;

@IntegrationTest
class LocationIntegrationTest {

    private static final UUID USER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a1");
    private static final GeoPoint KRAKOW = new GeoPoint(50.0619, 19.9369);

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PhotonStub photon;

    @Autowired
    LocationService locationService;

    @Autowired
    Locations locations;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM location");
    }

    @AfterEach
    void resetPhoton() {
        photon.reset();
    }

    @Test
    void storesOnlyAnApproximatedDeviceLocationWithTheTownOfThatPoint() throws Exception {
        setMine(50.061947, 19.936856, "DEVICE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Kraków, małopolskie"))
                .andExpect(jsonPath("$.city").value("Kraków"))
                .andExpect(jsonPath("$.region").value("małopolskie"))
                .andExpect(jsonPath("$.countryCode").value("PL"))
                .andExpect(jsonPath("$.latitude").value(50.06))
                .andExpect(jsonPath("$.longitude").value(19.94))
                .andExpect(jsonPath("$.source").value("DEVICE"))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        // The geocoder only ever sees the approximated point.
        assertThat(photon.requests()).singleElement().satisfies(uri -> assertThat(uri.getQuery())
                .contains("lat=50.06").contains("lon=19.94").doesNotContain("50.0619"));
        var stored = jdbc.queryForMap("SELECT latitude, longitude, precision, ST_Y(point::geometry) AS y,"
                + " ST_X(point::geometry) AS x FROM location");
        assertThat(stored).containsEntry("latitude", 50.06).containsEntry("longitude", 19.94)
                .containsEntry("precision", "APPROXIMATE").containsEntry("y", 50.06).containsEntry("x", 19.94);
    }

    @Test
    void savingAgainReplacesTheLocation() throws Exception {
        setMine(50.06, 19.94, "DEVICE").andExpect(status().isOk());
        photon.respondWithFixture("reverse-village.json");

        setMine(50.3049, 19.4991, "MANUAL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Wolbrom, Lesser Poland Voivodeship"))
                .andExpect(jsonPath("$.source").value("MANUAL"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM location", Long.class)).isEqualTo(1);
        as(get("/api/v1/locations/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Wolbrom"))
                .andExpect(jsonPath("$.latitude").value(50.3))
                .andExpect(jsonPath("$.longitude").value(19.5));
    }

    @Test
    void readingWithoutALocationIsNotSet() throws Exception {
        as(get("/api/v1/locations/me"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LOCATION_NOT_SET"));
    }

    @Test
    void deleteRemovesTheLocationAndIsIdempotent() throws Exception {
        setMine(50.06, 19.94, "DEVICE").andExpect(status().isOk());

        as(delete("/api/v1/locations/me")).andExpect(status().isNoContent());
        as(delete("/api/v1/locations/me")).andExpect(status().isNoContent());

        as(get("/api/v1/locations/me")).andExpect(status().isNotFound());
    }

    @Test
    void geocoderFailureIsServiceUnavailableAndStoresNothing() throws Exception {
        photon.respondWith(500, "{}");

        setMine(50.06, 19.94, "DEVICE")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LOCATION_GEOCODER_UNAVAILABLE"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM location", Long.class)).isZero();
    }

    @Test
    void pointWithoutATownIsRejected() throws Exception {
        photon.respondWithFixture("reverse-sea.json");

        setMine(55.0, 18.0, "DEVICE")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LOCATION_NOT_FOUND"));
    }

    @Test
    void rejectsCoordinatesOutOfRangeAndMissingSource() throws Exception {
        as(put("/api/v1/locations/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\": 91, \"longitude\": 19.9}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[?(@.field == 'latitude')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'source')]").exists());
    }

    @Test
    void searchReturnsSuggestionsInTheRequestLanguage() throws Exception {
        as(get("/api/v1/locations/search").param("q", "krak"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].label").value("Kraków, małopolskie"))
                .andExpect(jsonPath("$[0].latitude").value(50.0619474))
                .andExpect(jsonPath("$[0].kind").value("CITY"))
                .andExpect(jsonPath("$[1].label").value("Rynek Główny 1, Kraków"))
                .andExpect(jsonPath("$[1].kind").value("HOUSE"))
                .andExpect(jsonPath("$[1].street").value("Rynek Główny 1"))
                .andExpect(jsonPath("$[1].postalCode").value("31-042"));
        assertThat(photon.requests().getLast().getQuery()).contains("lang=default");

        as(get("/api/v1/locations/search").param("q", "krak").header("Accept-Language", "en"))
                .andExpect(status().isOk());
        assertThat(photon.requests().getLast().getQuery()).contains("lang=en");
    }

    @Test
    void searchNeedsAtLeastThreeCharacters() throws Exception {
        as(get("/api/v1/locations/search").param("q", "kr"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        assertThat(photon.requests()).isEmpty();
    }

    @Test
    void searchWhileTheGeocoderIsDownIsServiceUnavailable() throws Exception {
        photon.respondWith(502, "bad gateway");

        as(get("/api/v1/locations/search").param("q", "krak"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LOCATION_GEOCODER_UNAVAILABLE"));
    }

    @Test
    void anonymousCallersAreUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/locations/search").param("q", "krak")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/locations/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void findsSubjectsWithinARadiusNearestFirst() {
        var krakow = save(KRAKOW);
        var wieliczka = save(new GeoPoint(49.9871, 20.0647));
        var warszawa = save(new GeoPoint(52.2297, 21.0122));

        var near = locations.findWithin(SubjectType.USER, KRAKOW, 20, 10);
        assertThat(near).extracting(Nearby::subjectId).containsExactly(krakow, wieliczka);
        assertThat(near.get(0).distanceMeters()).isLessThan(1000);
        assertThat(near.get(1).distanceMeters()).isCloseTo(11_400, within(1_500.0));

        assertThat(locations.findWithin(SubjectType.USER, KRAKOW, 300, 10))
                .extracting(Nearby::subjectId).containsExactly(krakow, wieliczka, warszawa);
        assertThat(locations.findWithin(SubjectType.USER, KRAKOW, 300, 1))
                .extracting(Nearby::subjectId).containsExactly(krakow);
    }

    @Test
    void rejectsRadiusAndLimitOutOfRange() {
        assertThatThrownBy(() -> locations.findWithin(SubjectType.USER, KRAKOW, 0.5, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> locations.findWithin(SubjectType.USER, KRAKOW, 501, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> locations.findWithin(SubjectType.USER, KRAKOW, 10, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void geocodesAnAddressToItsExactPoint() {
        var found = locations.geocodeAddress("Rynek Główny 1, 31-042 Kraków", Locale.forLanguageTag("pl"));

        assertThat(found).contains(new GeocodedAddress("Rynek Główny 1", "31-042", "Kraków", "małopolskie", "PL",
                new GeoPoint(50.0617, 19.9372)));
        assertThat(photon.requests().getLast().getQuery()).contains("q=Rynek G");
    }

    @Test
    void anAddressThatOnlyMatchesATownIsNotFound() {
        photon.respondWith(200, """
                {"type": "FeatureCollection", "features": [{"type": "Feature",
                 "geometry": {"type": "Point", "coordinates": [19.93, 50.06]},
                 "properties": {"type": "city", "name": "Kraków", "countrycode": "PL"}}]}
                """);

        assertThat(locations.geocodeAddress("Nieistniejąca 999, Kraków", Locale.forLanguageTag("pl"))).isEmpty();
    }

    @Test
    void geocodingWhileTheGeocoderIsDownFails() {
        photon.respondWith(502, "bad gateway");

        assertThatThrownBy(() -> locations.geocodeAddress("Rynek Główny 1, Kraków", Locale.forLanguageTag("pl")))
                .isInstanceOf(pl.spotonslot.shared.error.ServiceUnavailableException.class);
    }

    private UUID save(GeoPoint point) {
        var user = UUID.randomUUID();
        locationService.setForUser(user, point, LocationSource.MANUAL, Locale.forLanguageTag("pl"));
        return user;
    }

    private ResultActions setMine(double latitude, double longitude, String source) throws Exception {
        return as(put("/api/v1/locations/me").contentType(MediaType.APPLICATION_JSON).content(
                "{\"latitude\": %s, \"longitude\": %s, \"source\": \"%s\"}".formatted(latitude, longitude, source)));
    }

    private ResultActions as(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(USER.toString()))));
    }
}
