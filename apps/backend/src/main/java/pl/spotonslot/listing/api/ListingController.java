package pl.spotonslot.listing.api;

import jakarta.validation.Valid;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

/**
 * Listings of the signed-in user: an artist's own "I'm free" under {@code /mine}, and any listing they may edit
 * (their own, or one of a venue whose team they are in) by id; others answer 404.
 */
@RestController
@RequestMapping("/api/v1/listings")
@RequiredArgsConstructor
class ListingController {

    static final Set<String> SORTABLE = Set.of("startsAt", "createdAt");
    static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");

    private final ListingService listings;

    /** The artist's listings, newest first; {@code status} filters by the status as of now. */
    @GetMapping("/mine")
    @PreAuthorize("hasRole('ARTIST')")
    PageResponse<ListingResponse> mine(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) ListingStatus status, @Valid @ParameterObject PageQuery query) {
        var page = listings.listOfArtist(user(jwt), status, query.toPageable(SORTABLE, DEFAULT_SORT));
        return PageResponse.from(page, page.getContent().stream().map(ListingResponse::of).toList());
    }

    /** "I'm free" for free time from the artist's calendar. */
    @PostMapping("/mine")
    @PreAuthorize("hasRole('ARTIST')")
    @ResponseStatus(HttpStatus.CREATED)
    ListingResponse announce(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ListingRequest request) {
        return ListingResponse.of(listings.announce(user(jwt), request.toDetails()));
    }

    @GetMapping("/{id}")
    ListingResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ListingResponse.of(listings.get(user(jwt), id));
    }

    /** Replaces the editable fields of an active listing; an artist's new time must be free in the calendar. */
    @PutMapping("/{id}")
    ListingResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ListingRequest request) {
        return ListingResponse.of(listings.update(user(jwt), id, request.toDetails()));
    }

    @PostMapping("/{id}/close")
    ListingResponse close(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ListingResponse.of(listings.close(user(jwt), id));
    }

    static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
