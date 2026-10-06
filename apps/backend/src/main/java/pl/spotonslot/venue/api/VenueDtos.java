package pl.spotonslot.venue.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.application.VenueService.Requirement;
import pl.spotonslot.venue.domain.VenueLinkKind;
import pl.spotonslot.venue.domain.VenueType;

/** Request and response shapes of the venue API. */
final class VenueDtos {

    static final String SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

    private VenueDtos() {
    }

    /** The whole editable venue; omitted lists mean empty, an omitted slug keeps (or derives) the address. */
    record SaveVenueRequest(
            @NotBlank @Size(max = 120) @Schema(requiredMode = REQUIRED, example = "Klub Pod Ziemią") String name,
            @NotNull @Schema(requiredMode = REQUIRED) VenueType type,
            @Size(max = 2000) String description,
            @Min(1) @Max(100_000) Integer capacity,
            @Valid AddressValue address,
            @Size(min = 3, max = 40) @Pattern(regexp = SLUG_PATTERN) @Schema(example = "pod-ziemia") String slug,
            @Size(max = 5) List<@NotNull Genre> genres,
            @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags,
            @Valid Links links,
            UUID avatarMediaId,
            @Size(max = 12) List<@NotNull UUID> photoMediaIds) {
    }

    /**
     * Street with house number, postal code and town. Send the coordinates of a picked suggestion
     * ({@code GET /api/v1/locations/search}); without both of them the backend geocodes the address.
     */
    @Schema(name = "VenueAddress")
    record AddressValue(
            @NotBlank @Size(max = 120) @Schema(requiredMode = REQUIRED, example = "Rynek Główny 1") String street,
            @Size(max = 12) @Schema(example = "31-042") String postalCode,
            @NotBlank @Size(max = 120) @Schema(requiredMode = REQUIRED, example = "Kraków") String city,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude) {
    }

    @Schema(name = "VenueLinks")
    record Links(
            @ValidVenueLink(VenueLinkKind.WEBSITE) @Schema(example = "https://podziemia.pl") String website,
            @ValidVenueLink(VenueLinkKind.INSTAGRAM) String instagram,
            @ValidVenueLink(VenueLinkKind.FACEBOOK) String facebook) {
    }

    @Schema(name = "VenueImage")
    record Image(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) int width,
            @Schema(requiredMode = REQUIRED) int height,
            @Schema(requiredMode = REQUIRED, description = "320 px WebP") String small,
            @Schema(requiredMode = REQUIRED, description = "800 px WebP") String medium,
            @Schema(requiredMode = REQUIRED, description = "1600 px WebP") String large) {
    }

    /** The team's view, including what is missing for publication and the caller's role. */
    record VenueResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String name,
            @Schema(requiredMode = REQUIRED) VenueType type,
            String description,
            Integer capacity,
            AddressValue address,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            @Schema(requiredMode = REQUIRED) List<String> tags,
            @Schema(requiredMode = REQUIRED) Links links,
            Image avatar,
            @Schema(requiredMode = REQUIRED) List<Image> photos,
            @Schema(requiredMode = REQUIRED) boolean published,
            Instant publishedAt,
            @Schema(requiredMode = REQUIRED) List<Requirement> missingForPublication,
            @Schema(requiredMode = REQUIRED) VenueRole role,
            @Schema(requiredMode = REQUIRED) Instant updatedAt) {
    }

    /** What anyone with the link sees: the public business data, no team. */
    record PublicVenueResponse(
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String name,
            @Schema(requiredMode = REQUIRED) VenueType type,
            String description,
            Integer capacity,
            @Schema(requiredMode = REQUIRED) AddressValue address,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            @Schema(requiredMode = REQUIRED) List<String> tags,
            @Schema(requiredMode = REQUIRED) Links links,
            Image avatar,
            @Schema(requiredMode = REQUIRED) List<Image> photos,
            @Schema(requiredMode = REQUIRED) Instant publishedAt) {
    }

    record InviteRequest(
            @NotBlank @Email @Size(max = 254) @Schema(requiredMode = REQUIRED) String email,
            @NotNull @Schema(requiredMode = REQUIRED) VenueRole role) {
    }

    record AcceptInvitationRequest(@NotBlank @Size(max = 100) @Schema(requiredMode = REQUIRED) String token) {
    }

    @Schema(name = "VenueTeamMember")
    record MemberResponse(
            @Schema(requiredMode = REQUIRED) UUID userId,
            String email,
            @Schema(requiredMode = REQUIRED) VenueRole role,
            @Schema(requiredMode = REQUIRED) Instant joinedAt) {
    }

    @Schema(name = "VenueInvitation")
    record InvitationResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String email,
            @Schema(requiredMode = REQUIRED) VenueRole role,
            @Schema(requiredMode = REQUIRED) Instant expiresAt) {
    }

    @Schema(name = "VenueTeam")
    record TeamResponse(
            @Schema(requiredMode = REQUIRED) List<MemberResponse> members,
            @Schema(requiredMode = REQUIRED) List<InvitationResponse> invitations) {
    }
}
