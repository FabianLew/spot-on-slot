package pl.spotonslot.location.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.application.LocationService;
import pl.spotonslot.location.domain.Location;

@RestController
@RequestMapping("/api/v1/locations")
@RequiredArgsConstructor
class LocationController {

    private final LocationService locationService;

    /** Suggestions for a typed city or address (proxied to the geocoder). */
    @GetMapping("/search")
    List<PlaceResponse> search(@RequestParam @NotBlank @Size(min = 3, max = 100) String q, Locale locale) {
        return locationService.search(q, locale).stream()
                .map(place -> new PlaceResponse(place.kind(), place.label(), place.street(),
                        place.postalCode(), place.city(), place.region(), place.countryCode(),
                        place.point().latitude(), place.point().longitude()))
                .toList();
    }

    @PutMapping("/me")
    LocationResponse setMine(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SetLocationRequest request,
            Locale locale) {
        var point = new GeoPoint(request.latitude(), request.longitude());
        return toResponse(locationService.setForUser(user(jwt), point, request.source(), locale));
    }

    @GetMapping("/me")
    LocationResponse getMine(@AuthenticationPrincipal Jwt jwt) {
        return toResponse(locationService.getForUser(user(jwt)));
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteMine(@AuthenticationPrincipal Jwt jwt) {
        locationService.deleteForUser(user(jwt));
    }

    static LocationResponse toResponse(Location location) {
        return new LocationResponse(location.getLabel(), location.getCity(), location.getRegion(),
                location.getCountryCode(), location.getLatitude(), location.getLongitude(), location.getSource(),
                location.getUpdatedAt());
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
