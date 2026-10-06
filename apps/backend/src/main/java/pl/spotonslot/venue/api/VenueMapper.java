package pl.spotonslot.venue.api;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.media.MediaImage;
import pl.spotonslot.media.MediaLibrary;
import pl.spotonslot.venue.api.VenueDtos.AddressValue;
import pl.spotonslot.venue.api.VenueDtos.Image;
import pl.spotonslot.venue.api.VenueDtos.InvitationResponse;
import pl.spotonslot.venue.api.VenueDtos.Links;
import pl.spotonslot.venue.api.VenueDtos.MemberResponse;
import pl.spotonslot.venue.api.VenueDtos.PublicVenueResponse;
import pl.spotonslot.venue.api.VenueDtos.SaveVenueRequest;
import pl.spotonslot.venue.api.VenueDtos.TeamResponse;
import pl.spotonslot.venue.api.VenueDtos.VenueResponse;
import pl.spotonslot.venue.application.ManagedVenue;
import pl.spotonslot.venue.application.VenueService;
import pl.spotonslot.venue.application.VenueTeamService.Team;
import pl.spotonslot.venue.domain.Address;
import pl.spotonslot.venue.domain.Venue;
import pl.spotonslot.venue.domain.VenueDetails;
import pl.spotonslot.venue.domain.VenueInvitation;
import pl.spotonslot.venue.domain.VenueLinkKind;

/** Between API shapes and the domain; resolves photos through the media facade. */
@Component
@RequiredArgsConstructor
class VenueMapper {

    private final VenueService venues;
    private final MediaLibrary mediaLibrary;

    VenueDetails toDetails(SaveVenueRequest request) {
        var links = new EnumMap<VenueLinkKind, String>(VenueLinkKind.class);
        if (request.links() != null) {
            putIfPresent(links, VenueLinkKind.WEBSITE, request.links().website());
            putIfPresent(links, VenueLinkKind.INSTAGRAM, request.links().instagram());
            putIfPresent(links, VenueLinkKind.FACEBOOK, request.links().facebook());
        }
        var genres = EnumSet.noneOf(Genre.class);
        if (request.genres() != null) {
            genres.addAll(request.genres());
        }
        return new VenueDetails(
                request.name().strip(),
                request.type(),
                blankToNull(request.description()),
                request.capacity(),
                address(request.address()),
                genres,
                tags(request.tags()),
                links,
                request.avatarMediaId(),
                request.photoMediaIds() == null ? List.of() : request.photoMediaIds().stream().distinct().toList());
    }

    VenueResponse toResponse(ManagedVenue managed) {
        var venue = managed.venue();
        return new VenueResponse(venue.getId(), venue.getSlug(), venue.getName(), venue.getType(),
                venue.getDescription(), venue.getCapacity(), address(venue), genres(venue),
                List.copyOf(venue.getTags()), links(venue), avatar(venue), photos(venue), venue.isPublished(),
                venue.getPublishedAt(), venues.missingForPublication(venue), managed.role(), venue.getUpdatedAt());
    }

    PublicVenueResponse toPublicResponse(Venue venue) {
        return new PublicVenueResponse(venue.getSlug(), venue.getName(), venue.getType(), venue.getDescription(),
                venue.getCapacity(), address(venue), genres(venue), List.copyOf(venue.getTags()), links(venue),
                avatar(venue), photos(venue), venue.getPublishedAt());
    }

    TeamResponse toResponse(Team team) {
        var members = team.members().stream()
                .map(member -> new MemberResponse(member.getUserId(), team.emails().get(member.getUserId()),
                        member.getRole(), member.getCreatedAt()))
                .toList();
        return new TeamResponse(members, team.invitations().stream().map(VenueMapper::toResponse).toList());
    }

    static InvitationResponse toResponse(VenueInvitation invitation) {
        return new InvitationResponse(invitation.getId(), invitation.getEmail(), invitation.getRole(),
                invitation.getExpiresAt());
    }

    /** A point counts only when both coordinates are sent. */
    private static Address address(AddressValue value) {
        if (value == null) {
            return null;
        }
        var point = value.latitude() != null && value.longitude() != null
                ? new GeoPoint(value.latitude(), value.longitude())
                : null;
        return Address.of(value.street().strip(), blankToNull(value.postalCode()), value.city().strip(), point);
    }

    private static AddressValue address(Venue venue) {
        return venue.address()
                .map(found -> new AddressValue(found.street(), found.postalCode(), found.city(), found.latitude(),
                        found.longitude()))
                .orElse(null);
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

    private static List<Genre> genres(Venue venue) {
        return new ArrayList<>(new TreeSet<>(venue.getGenres()));
    }

    private static Links links(Venue venue) {
        Map<VenueLinkKind, String> links = venue.getLinks();
        return new Links(links.get(VenueLinkKind.WEBSITE), links.get(VenueLinkKind.INSTAGRAM),
                links.get(VenueLinkKind.FACEBOOK));
    }

    private Image avatar(Venue venue) {
        return venue.avatar().flatMap(mediaLibrary::find).map(VenueMapper::image).orElse(null);
    }

    private List<Image> photos(Venue venue) {
        return mediaLibrary.findAll(venue.getPhotoMediaIds()).stream().map(VenueMapper::image).toList();
    }

    private static Image image(MediaImage image) {
        return new Image(image.id(), image.width(), image.height(), image.small(), image.medium(), image.large());
    }

    private static void putIfPresent(Map<VenueLinkKind, String> links, VenueLinkKind kind, String url) {
        var value = blankToNull(url);
        if (value != null) {
            links.put(kind, value);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
