package pl.spotonslot.search.api;

import jakarta.validation.Valid;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.search.api.SearchDtos.AreaParams;
import pl.spotonslot.search.api.SearchDtos.ArtistHit;
import pl.spotonslot.search.api.SearchDtos.ArtistParams;
import pl.spotonslot.search.api.SearchDtos.ListingHit;
import pl.spotonslot.search.api.SearchDtos.ListingParams;
import pl.spotonslot.search.api.SearchDtos.VenueHit;
import pl.spotonslot.search.api.SearchDtos.VenueParams;
import pl.spotonslot.search.application.SearchService;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;
import pl.spotonslot.venue.VenueType;

/**
 * Search for signed-in users of any role, nearest first (then by name). Results are pages of at most 100; only the
 * nearest 1000 candidates of each kind are considered.
 */
@RestController
@RequestMapping("/api/v1/search")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
class SearchController {

    /** Order is always by distance; {@code sort} is refused. */
    private static final Set<String> SORTABLE = Set.of();

    private final SearchService search;

    /** Published artists; with {@code from}/{@code to} only those free for that whole time. */
    @GetMapping("/artists")
    PageResponse<ArtistHit> artists(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject AreaParams area,
            @Valid @ParameterObject ArtistParams params, @Valid @ParameterObject PageQuery query) {
        var page = search.artists(user(jwt), area.toArea(), params.toFilters(),
                query.toPageable(SORTABLE, Sort.unsorted()));
        return PageResponse.from(page, page.getContent().stream().map(ArtistHit::of).toList());
    }

    /** Published venues. */
    @GetMapping("/venues")
    PageResponse<VenueHit> venues(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject AreaParams area,
            @Valid @ParameterObject VenueParams params, @Valid @ParameterObject PageQuery query) {
        var page = search.venues(user(jwt), area.toArea(), SearchDtos.genreSet(params.genres()),
                SearchDtos.set(params.types(), VenueType.class), query.toPageable(SORTABLE, Sort.unsorted()));
        return PageResponse.from(page, page.getContent().stream().map(VenueHit::of).toList());
    }

    /** Active listings of published artists and venues. */
    @GetMapping("/listings")
    PageResponse<ListingHit> listings(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject AreaParams area,
            @Valid @ParameterObject ListingParams params, @Valid @ParameterObject PageQuery query) {
        var page = search.listings(user(jwt), area.toArea(), params.toFilters(),
                query.toPageable(SORTABLE, Sort.unsorted()));
        return PageResponse.from(page, page.getContent().stream().map(ListingHit::of).toList());
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
