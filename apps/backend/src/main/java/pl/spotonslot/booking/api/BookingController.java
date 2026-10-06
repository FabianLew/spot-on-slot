package pl.spotonslot.booking.api;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
import pl.spotonslot.booking.BookingStatus;
import pl.spotonslot.booking.api.BookingDtos.AcceptRequest;
import pl.spotonslot.booking.api.BookingDtos.BookingResponse;
import pl.spotonslot.booking.api.BookingDtos.CancelRequest;
import pl.spotonslot.booking.api.BookingDtos.CounterRequest;
import pl.spotonslot.booking.api.BookingDtos.CreateBookingRequest;
import pl.spotonslot.booking.api.BookingDtos.DeclineRequest;
import pl.spotonslot.booking.application.BookingFilter;
import pl.spotonslot.booking.application.BookingService;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;

/**
 * Bookings of the signed-in user: as the artist, or for the venues whose team they are in. Anybody else gets 404
 * for a booking.
 */
@RestController
@RequestMapping("/api/v1/bookings")
@PreAuthorize("hasAnyRole('ARTIST', 'VENUE')")
@RequiredArgsConstructor
class BookingController {

    static final Set<String> SORTABLE = Set.of("startsAt", "createdAt", "updatedAt");
    static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "startsAt");

    private final BookingService bookings;

    /**
     * The caller's bookings, soonest first. {@code status} (repeatable: any of) filters by the status as of now,
     * {@code from}/{@code to}
     * by overlapping time, {@code awaitingMe} keeps those waiting for the caller's answer.
     */
    @GetMapping
    PageResponse<BookingResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Set<BookingStatus> status, @RequestParam(required = false) UUID venueId,
            @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "false") boolean awaitingMe, @Valid @ParameterObject PageQuery query) {
        var page = bookings.list(user(jwt), new BookingFilter(status, venueId, from, to, awaitingMe),
                query.toPageable(SORTABLE, DEFAULT_SORT));
        return PageResponse.from(page, page.getContent().stream().map(BookingResponse::of).toList());
    }

    /** A venue's request to an artist, or an artist's application to a venue's listing (by the caller's role). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BookingResponse create(@AuthenticationPrincipal Jwt jwt, Authentication authentication,
            @Valid @RequestBody CreateBookingRequest request) {
        var message = BookingDtos.text(request.message());
        var artist = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ARTIST".equals(authority.getAuthority()));
        var view = artist
                ? bookings.apply(user(jwt), request.listingId(), request.amount(), message)
                : bookings.request(user(jwt), request.venueId(), request.artistSlug(), request.listingId(),
                        request.startsAt(), request.endsAt(), request.amount(), message);
        return BookingResponse.of(view);
    }

    @GetMapping("/{id}")
    BookingResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return BookingResponse.of(bookings.get(user(jwt), id));
    }

    @PostMapping("/{id}/counter")
    BookingResponse counter(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody CounterRequest request) {
        return BookingResponse.of(bookings.counter(user(jwt), id, request.toTerms()));
    }

    /** Accepts the current proposal and books the artist's time. */
    @PostMapping("/{id}/accept")
    BookingResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody AcceptRequest request) {
        return BookingResponse.of(bookings.accept(user(jwt), id, request.revision()));
    }

    @PostMapping("/{id}/decline")
    BookingResponse decline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody(required = false) DeclineRequest request) {
        return BookingResponse.of(bookings.decline(user(jwt), id,
                request == null ? null : BookingDtos.text(request.reason())));
    }

    @PostMapping("/{id}/withdraw")
    BookingResponse withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return BookingResponse.of(bookings.withdraw(user(jwt), id));
    }

    /** Cancels an accepted booking before it starts; the time is free in the artist's calendar again. */
    @PostMapping("/{id}/cancel")
    BookingResponse cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody CancelRequest request) {
        return BookingResponse.of(bookings.cancel(user(jwt), id, request.reason().strip()));
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
