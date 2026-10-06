package pl.spotonslot.venue.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.venue.api.VenueDtos.PublicVenueResponse;
import pl.spotonslot.venue.application.VenueService;

/** Published venues for anyone with the link, no sign-in (under {@code /api/v1/public/**}). */
@RestController
@RequestMapping("/api/v1/public/venues")
@RequiredArgsConstructor
class PublicVenueController {

    private final VenueService venues;
    private final VenueMapper mapper;

    @GetMapping("/{slug}")
    PublicVenueResponse get(@PathVariable String slug) {
        return mapper.toPublicResponse(venues.getPublished(slug));
    }
}
