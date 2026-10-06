package pl.spotonslot.artist.api;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.artist.api.ArtistDtos.Image;
import pl.spotonslot.artist.api.ArtistDtos.Links;
import pl.spotonslot.artist.api.ArtistDtos.Place;
import pl.spotonslot.artist.api.ArtistDtos.ProfileResponse;
import pl.spotonslot.artist.api.ArtistDtos.PublicProfileResponse;
import pl.spotonslot.artist.api.ArtistDtos.Rate;
import pl.spotonslot.artist.api.ArtistDtos.SaveProfileRequest;
import pl.spotonslot.artist.api.ArtistDtos.SkillValues;
import pl.spotonslot.artist.application.ArtistProfileService;
import pl.spotonslot.artist.domain.ArtistDetails;
import pl.spotonslot.artist.domain.ArtistProfile;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.artist.domain.LinkKind;
import pl.spotonslot.artist.domain.Skills;
import pl.spotonslot.location.Locations;
import pl.spotonslot.media.MediaImage;
import pl.spotonslot.media.MediaLibrary;

/** Between API shapes and the domain; resolves photos and the town through the media and location facades. */
@Component
@RequiredArgsConstructor
class ArtistMapper {

    private static final String CURRENCY = "PLN";

    private final ArtistProfileService profiles;
    private final MediaLibrary mediaLibrary;
    private final Locations locations;

    ArtistDetails toDetails(SaveProfileRequest request) {
        var links = new EnumMap<LinkKind, String>(LinkKind.class);
        if (request.links() != null) {
            putIfPresent(links, LinkKind.SOUNDCLOUD, request.links().soundcloud());
            putIfPresent(links, LinkKind.SPOTIFY, request.links().spotify());
            putIfPresent(links, LinkKind.INSTAGRAM, request.links().instagram());
            putIfPresent(links, LinkKind.YOUTUBE, request.links().youtube());
        }
        var skills = request.skills() == null ? Skills.NONE : new Skills(request.skills().tempo(),
                request.skills().experience(), request.skills().energy(), request.skills().vinyl(),
                request.skills().cdj(), request.skills().production());
        var genres = EnumSet.noneOf(Genre.class);
        if (request.genres() != null) {
            genres.addAll(request.genres());
        }
        return new ArtistDetails(
                request.stageName().strip(),
                blankToNull(request.firstName()),
                blankToNull(request.lastName()),
                blankToNull(request.bio()),
                genres,
                tags(request.tags()),
                links,
                request.rateFrom(),
                request.rateTo(),
                request.travelRadiusKm() == null ? ArtistProfile.DEFAULT_TRAVEL_RADIUS_KM : request.travelRadiusKm(),
                skills,
                request.avatarMediaId(),
                request.photoMediaIds() == null ? List.of() : request.photoMediaIds().stream().distinct().toList());
    }

    ProfileResponse toResponse(ArtistProfile profile) {
        return new ProfileResponse(profile.getId(), profile.getSlug(), profile.getStageName(),
                profile.getFirstName(), profile.getLastName(), profile.getBio(), genres(profile),
                List.copyOf(profile.getTags()), links(profile), rate(profile), profile.getTravelRadiusKm(),
                skills(profile), avatar(profile), photos(profile), place(profile), profile.isPublished(),
                profile.getPublishedAt(), profiles.missingForPublication(profile), profile.getUpdatedAt());
    }

    PublicProfileResponse toPublicResponse(ArtistProfile profile) {
        return new PublicProfileResponse(profile.getSlug(), profile.getStageName(), profile.getBio(),
                genres(profile), List.copyOf(profile.getTags()), links(profile), rate(profile),
                profile.getTravelRadiusKm(), skills(profile), avatar(profile), photos(profile), place(profile),
                profile.getPublishedAt());
    }

    /** Trimmed, without case-insensitive duplicates, in the order given. */
    private static List<String> tags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        var seen = new TreeSet<String>(String.CASE_INSENSITIVE_ORDER);
        var result = new ArrayList<String>();
        for (var tag : tags) {
            var trimmed = tag.strip();
            if (seen.add(trimmed)) {
                result.add(trimmed);
            }
        }
        return result;
    }

    private static List<Genre> genres(ArtistProfile profile) {
        return new ArrayList<>(new TreeSet<>(profile.getGenres()));
    }

    private static Links links(ArtistProfile profile) {
        Map<LinkKind, String> links = profile.getLinks();
        return new Links(links.get(LinkKind.SOUNDCLOUD), links.get(LinkKind.SPOTIFY), links.get(LinkKind.INSTAGRAM),
                links.get(LinkKind.YOUTUBE));
    }

    private static Rate rate(ArtistProfile profile) {
        if (profile.getRateFrom() == null && profile.getRateTo() == null) {
            return null;
        }
        return new Rate(profile.getRateFrom(), profile.getRateTo(), CURRENCY);
    }

    private static SkillValues skills(ArtistProfile profile) {
        var skills = profile.skills();
        return new SkillValues(skills.tempo(), skills.experience(), skills.energy(), skills.vinyl(), skills.cdj(),
                skills.production());
    }

    private Image avatar(ArtistProfile profile) {
        return profile.avatar().flatMap(mediaLibrary::find).map(ArtistMapper::image).orElse(null);
    }

    private List<Image> photos(ArtistProfile profile) {
        return mediaLibrary.findAll(profile.getPhotoMediaIds()).stream().map(ArtistMapper::image).toList();
    }

    private Place place(ArtistProfile profile) {
        return locations.findForUser(profile.getOwnerId())
                .map(found -> new Place(found.label(), found.city(), found.region(), found.countryCode()))
                .orElse(null);
    }

    private static Image image(MediaImage image) {
        return new Image(image.id(), image.width(), image.height(), image.small(), image.medium(), image.large());
    }

    private static void putIfPresent(Map<LinkKind, String> links, LinkKind kind, String url) {
        var value = blankToNull(url);
        if (value != null) {
            links.put(kind, value);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
