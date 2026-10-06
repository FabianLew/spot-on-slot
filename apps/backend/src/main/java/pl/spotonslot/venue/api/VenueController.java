package pl.spotonslot.venue.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.venue.VenueType;
import pl.spotonslot.venue.api.VenueDtos.AcceptInvitationRequest;
import pl.spotonslot.venue.api.VenueDtos.InvitationResponse;
import pl.spotonslot.venue.api.VenueDtos.InviteRequest;
import pl.spotonslot.venue.api.VenueDtos.SaveVenueRequest;
import pl.spotonslot.venue.api.VenueDtos.TeamResponse;
import pl.spotonslot.venue.api.VenueDtos.VenueResponse;
import pl.spotonslot.venue.application.VenueService;
import pl.spotonslot.venue.application.VenueTeamService;

/** Venues of the signed-in VENUE account; a venue outside the caller's teams answers 404. */
@RestController
@RequestMapping("/api/v1/venues")
@PreAuthorize("hasRole('VENUE')")
@RequiredArgsConstructor
class VenueController {

    private final VenueService venues;
    private final VenueTeamService teams;
    private final VenueMapper mapper;

    @PreAuthorize("permitAll()")
    @GetMapping("/types")
    List<VenueType> types() {
        return Arrays.asList(VenueType.values());
    }

    @GetMapping("/mine")
    List<VenueResponse> mine(@AuthenticationPrincipal Jwt jwt) {
        return venues.listMine(user(jwt)).stream().map(mapper::toResponse).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    VenueResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveVenueRequest request,
            Locale locale) {
        return mapper.toResponse(venues.create(user(jwt), mapper.toDetails(request), request.slug(), locale));
    }

    @GetMapping("/{id}")
    VenueResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return mapper.toResponse(venues.get(user(jwt), id));
    }

    /** Replaces all editable fields (owners and managers). */
    @PutMapping("/{id}")
    VenueResponse save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody SaveVenueRequest request, Locale locale) {
        return mapper.toResponse(venues.save(user(jwt), id, mapper.toDetails(request), request.slug(), locale));
    }

    @PostMapping("/{id}/publish")
    VenueResponse publish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return mapper.toResponse(venues.publish(user(jwt), id));
    }

    @PostMapping("/{id}/unpublish")
    VenueResponse unpublish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return mapper.toResponse(venues.unpublish(user(jwt), id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        venues.delete(user(jwt), id);
    }

    @GetMapping("/{id}/team")
    TeamResponse team(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return mapper.toResponse(teams.get(user(jwt), id));
    }

    /** Sends an invitation e-mail (owners only); inviting the same address again replaces the pending invitation. */
    @PostMapping("/{id}/team/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    InvitationResponse invite(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody InviteRequest request, Locale locale) {
        return VenueMapper.toResponse(teams.invite(user(jwt), id, request.email(), request.role(), locale));
    }

    @DeleteMapping("/{id}/team/invitations/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancelInvitation(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID invitationId) {
        teams.cancelInvitation(user(jwt), id, invitationId);
    }

    /** Owners remove members; anyone may remove themselves (leave). */
    @DeleteMapping("/{id}/team/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeMember(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID userId) {
        teams.removeMember(user(jwt), id, userId);
    }

    /** The token from the invitation e-mail travels in the body, so it never lands in access logs. */
    @PostMapping("/invitations/accept")
    VenueResponse accept(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AcceptInvitationRequest request) {
        return mapper.toResponse(teams.accept(user(jwt), request.token()));
    }

    /** 204 when the address is free (or already this venue's, given {@code venueId}), otherwise a problem. */
    @GetMapping("/slugs/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void checkSlug(@PathVariable @Size(min = 3, max = 40) @Pattern(regexp = VenueDtos.SLUG_PATTERN) String slug,
            @RequestParam(required = false) UUID venueId) {
        venues.checkSlugAvailable(slug, venueId);
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
