package pl.spotonslot.location.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.application.Geocoder;
import pl.spotonslot.location.domain.Area;
import pl.spotonslot.location.domain.LocationErrors;
import pl.spotonslot.location.domain.Place;

/**
 * <a href="https://github.com/komoot/photon">Photon</a> geocoder over OpenStreetMap data. Polish names come from
 * {@code lang=default} (the local OSM names); Photon has no {@code pl} language.
 */
@RequiredArgsConstructor
public class PhotonGeocoder implements Geocoder {

    /** Photon feature types precise enough to suggest; countries, states and other objects are skipped. */
    private static final Map<String, Place.Kind> SUGGESTED_TYPES = Map.of("city", Place.Kind.CITY,
            "district", Place.Kind.DISTRICT, "locality", Place.Kind.LOCALITY, "street", Place.Kind.STREET,
            "house", Place.Kind.HOUSE);
    private static final String VOIVODESHIP_PREFIX = "województwo ";

    private final RestClient restClient;
    private final String userAgent;
    private final int limit;
    private final GeoPoint bias;

    @Override
    public List<Place> search(String query, Locale locale) {
        var features = fetch(uri -> uri.path("/api")
                .queryParam("q", query)
                .queryParam("limit", limit)
                .queryParam("lang", language(locale))
                .queryParam("lat", bias.latitude())
                .queryParam("lon", bias.longitude()));
        var places = new ArrayList<Place>();
        for (var feature : features) {
            var properties = feature.path("properties");
            var city = city(properties);
            var kind = SUGGESTED_TYPES.get(String.valueOf(text(properties, "type")));
            if (kind == null || city == null) {
                continue;
            }
            var coordinates = feature.path("geometry").path("coordinates");
            var point = new GeoPoint(coordinates.path(1).asDouble(), coordinates.path(0).asDouble());
            var region = region(properties);
            places.add(new Place(kind, label(properties, city, region), street(kind, properties),
                    text(properties, "postcode"), city, region, countryCode(properties), point));
        }
        return places;
    }

    @Override
    public Optional<Area> reverse(GeoPoint point, Locale locale) {
        var features = fetch(uri -> uri.path("/reverse")
                .queryParam("lat", point.latitude())
                .queryParam("lon", point.longitude())
                .queryParam("limit", 1)
                .queryParam("lang", language(locale)));
        for (var feature : features) {
            var properties = feature.path("properties");
            var city = city(properties);
            if (city != null) {
                return Optional.of(new Area(city, region(properties), countryCode(properties)));
            }
        }
        return Optional.empty();
    }

    private JsonNode fetch(Function<UriBuilder, UriBuilder> uri) {
        try {
            var body = restClient.get()
                    .uri(builder -> uri.apply(builder).build())
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(JsonNode.class);
            return body == null ? MissingNode.getInstance() : body.path("features");
        } catch (RestClientException e) {
            throw new LocationErrors.GeocoderUnavailable(e);
        }
    }

    private static String language(Locale locale) {
        return locale != null && "en".equals(locale.getLanguage()) ? "en" : "default";
    }

    /** The town: the object itself when it is one, otherwise the town of its address. */
    private static String city(JsonNode properties) {
        if ("city".equals(text(properties, "type"))) {
            return text(properties, "name");
        }
        return text(properties, "city");
    }

    /** "Rynek Główny 1" for an address, "Krakowska" for a street, null for a town or district. */
    private static String street(Place.Kind kind, JsonNode properties) {
        return switch (kind) {
            case HOUSE -> {
                var street = text(properties, "street");
                var number = text(properties, "housenumber");
                yield street == null || number == null ? street : street + " " + number;
            }
            case STREET -> text(properties, "name");
            default -> null;
        };
    }

    private static String region(JsonNode properties) {
        var state = text(properties, "state");
        if (state != null && state.startsWith(VOIVODESHIP_PREFIX)) {
            return state.substring(VOIVODESHIP_PREFIX.length());
        }
        return state;
    }

    private static String countryCode(JsonNode properties) {
        var code = text(properties, "countrycode");
        return code == null ? null : code.toUpperCase(Locale.ROOT);
    }

    /** "Kraków, małopolskie" for a town, "Rynek Główny 1, Kraków" for an address, "Krakowska, Kraków" for a street. */
    private static String label(JsonNode properties, String city, String region) {
        var parts = new LinkedHashSet<String>();
        switch (text(properties, "type")) {
            case "city" -> {
                parts.add(city);
                if (region != null) {
                    parts.add(region);
                }
            }
            case "house" -> {
                var street = text(properties, "street");
                var number = text(properties, "housenumber");
                var name = text(properties, "name");
                if (street != null) {
                    parts.add(number == null ? street : street + " " + number);
                } else if (name != null) {
                    parts.add(name);
                }
                parts.add(city);
            }
            default -> {
                parts.add(text(properties, "name"));
                parts.add(city);
            }
        }
        parts.remove(null);
        return String.join(", ", parts);
    }

    private static String text(JsonNode node, String field) {
        var value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }
}
