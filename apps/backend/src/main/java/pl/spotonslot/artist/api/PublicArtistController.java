package pl.spotonslot.artist.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.artist.api.ArtistDtos.PublicProfileResponse;
import pl.spotonslot.artist.application.ArtistProfileService;

/** Published profiles for anyone with the link, no sign-in (under {@code /api/v1/public/**}). */
@RestController
@RequestMapping("/api/v1/public/artists")
@RequiredArgsConstructor
class PublicArtistController {

    private final ArtistProfileService profiles;
    private final ArtistMapper mapper;

    @GetMapping("/{slug}")
    PublicProfileResponse get(@PathVariable String slug) {
        return mapper.toPublicResponse(profiles.getPublished(slug));
    }
}
