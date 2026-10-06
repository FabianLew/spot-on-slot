package pl.spotonslot.listing.api;

import static pl.spotonslot.listing.api.ListingController.DEFAULT_SORT;
import static pl.spotonslot.listing.api.ListingController.SORTABLE;
import static pl.spotonslot.listing.api.ListingController.user;

import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.listing.api.ListingDtos.ListingRequest;
import pl.spotonslot.listing.api.ListingDtos.ListingResponse;
import pl.spotonslot.listing.application.ListingService;
import pl.spotonslot.listing.domain.ListingStatus;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;

/** "Looking for an artist" listings of a venue, for its owners and managers; other callers get 404. */
@RestController
@RequestMapping("/api/v1/venues/{venueId}/listings")
@PreAuthorize("hasRole('VENUE')")
@RequiredArgsConstructor
class VenueListingController {

    private final ListingService listings;

    /** The venue's listings, newest first; {@code status} filters by the status as of now. */
    @GetMapping
    PageResponse<ListingResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID venueId,
            @RequestParam(required = false) ListingStatus status, @Valid @ParameterObject PageQuery query) {
        var page = listings.listOfVenue(user(jwt), venueId, status, query.toPageable(SORTABLE, DEFAULT_SORT));
        return PageResponse.from(page, page.getContent().stream().map(ListingResponse::of).toList());
    }

    /** Posts a listing for a published venue. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ListingResponse seek(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID venueId,
            @Valid @RequestBody ListingRequest request) {
        return ListingResponse.of(listings.seek(user(jwt), venueId, request.toDetails()));
    }
}
