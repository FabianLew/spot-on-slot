package pl.spotonslot.artist.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.artist.api.ArtistDtos.ProfileResponse;
import pl.spotonslot.artist.api.ArtistDtos.SaveProfileRequest;
import pl.spotonslot.artist.application.ArtistProfileService;
import pl.spotonslot.artist.domain.Genre;

@RestController
@RequestMapping("/api/v1/artists")
@RequiredArgsConstructor
class ArtistController {

    private final ArtistProfileService profiles;
    private final ArtistMapper mapper;

    @GetMapping("/genres")
    List<Genre> genres() {
        return Arrays.asList(Genre.values());
    }

    @PreAuthorize("hasRole('ARTIST')")
    @GetMapping("/me")
    ProfileResponse getMine(@AuthenticationPrincipal Jwt jwt) {
        return mapper.toResponse(profiles.getForOwner(owner(jwt)));
    }

    /** Creates the profile on first save; afterwards replaces all editable fields. */
    @PreAuthorize("hasRole('ARTIST')")
    @PutMapping("/me")
    ProfileResponse saveMine(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveProfileRequest request) {
        return mapper.toResponse(profiles.save(owner(jwt), mapper.toDetails(request), request.slug()));
    }

    @PreAuthorize("hasRole('ARTIST')")
    @PostMapping("/me/publish")
    ProfileResponse publish(@AuthenticationPrincipal Jwt jwt) {
        return mapper.toResponse(profiles.publish(owner(jwt)));
    }

    @PreAuthorize("hasRole('ARTIST')")
    @PostMapping("/me/unpublish")
    ProfileResponse unpublish(@AuthenticationPrincipal Jwt jwt) {
        return mapper.toResponse(profiles.unpublish(owner(jwt)));
    }

    /** 204 when the address is free (or already the caller's), otherwise a problem. */
    @PreAuthorize("hasRole('ARTIST')")
    @GetMapping("/slugs/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void checkSlug(@AuthenticationPrincipal Jwt jwt,
            @PathVariable @Size(min = 3, max = 40) @Pattern(regexp = ArtistDtos.SLUG_PATTERN) String slug) {
        profiles.checkSlugAvailable(owner(jwt), slug);
    }

    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
