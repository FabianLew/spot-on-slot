package pl.spotonslot.listing.api;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.listing.api.ListingDtos.ListingResponse;
import pl.spotonslot.listing.application.ListingService;

/** Active listings for anyone with the link, no sign-in (under {@code /api/v1/public/**}). */
@RestController
@RequestMapping("/api/v1/public/listings")
@RequiredArgsConstructor
class PublicListingController {

    private final ListingService listings;

    @GetMapping("/{id}")
    ListingResponse get(@PathVariable UUID id) {
        return ListingResponse.of(listings.getPublic(id));
    }
}
