package pl.spotonslot.artist.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.application.ArtistProfileService.Requirement;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.artist.domain.LinkKind;

/** Request and response shapes of the artist API. */
final class ArtistDtos {

    static final String SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";
    /** 100 000 PLN in grosze. */
    static final long MAX_RATE = 10_000_000L;

    private ArtistDtos() {
    }

    /** The whole editable profile; omitted lists mean empty, an omitted slug keeps the current address. */
    record SaveProfileRequest(
            @NotBlank @Size(max = 60) @Schema(requiredMode = REQUIRED, example = "Weronika") String stageName,
            @Size(max = 60) String firstName,
            @Size(max = 80) String lastName,
            @Size(max = 2000) String bio,
            @Size(min = 3, max = 40) @Pattern(regexp = SLUG_PATTERN) @Schema(example = "weronika") String slug,
            @Size(max = 5) List<@NotNull Genre> genres,
            @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags,
            @Valid Links links,
            @PositiveOrZero @Max(MAX_RATE) @Schema(description = "Grosze") Long rateFrom,
            @PositiveOrZero @Max(MAX_RATE) @Schema(description = "Grosze") Long rateTo,
            @Min(0) @Max(500) @Schema(description = "Defaults to 50 km") Integer travelRadiusKm,
            @Valid SkillValues skills,
            UUID avatarMediaId,
            @Size(max = 12) List<@NotNull UUID> photoMediaIds) {
    }

    @Schema(name = "ArtistLinks")
    record Links(
            @ValidLink(LinkKind.SOUNDCLOUD) @Schema(example = "https://soundcloud.com/weronika") String soundcloud,
            @ValidLink(LinkKind.SPOTIFY) String spotify,
            @ValidLink(LinkKind.INSTAGRAM) String instagram,
            @ValidLink(LinkKind.YOUTUBE) String youtube) {
    }

    /** Self-assessed, 1–10 each, all optional. */
    @Schema(name = "ArtistSkills")
    record SkillValues(
            @Min(1) @Max(10) Integer tempo,
            @Min(1) @Max(10) Integer experience,
            @Min(1) @Max(10) Integer energy,
            @Min(1) @Max(10) Integer vinyl,
            @Min(1) @Max(10) Integer cdj,
            @Min(1) @Max(10) Integer production) {
    }

    @Schema(name = "ArtistRate", description = "Indicative fee per performance, in grosze")
    record Rate(Long from, Long to, @Schema(requiredMode = REQUIRED, example = "PLN") String currency) {
    }

    @Schema(name = "ProfileImage")
    record Image(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) int width,
            @Schema(requiredMode = REQUIRED) int height,
            @Schema(requiredMode = REQUIRED, description = "320 px WebP") String small,
            @Schema(requiredMode = REQUIRED, description = "800 px WebP") String medium,
            @Schema(requiredMode = REQUIRED, description = "1600 px WebP") String large) {
    }

    /** The town only; profiles never expose coordinates. */
    @Schema(name = "ProfileLocation")
    record Place(
            @Schema(requiredMode = REQUIRED, example = "Kraków, małopolskie") String label,
            @Schema(requiredMode = REQUIRED) String city,
            String region,
            String countryCode) {
    }

    /** The artist's own view, including private fields and what is missing for publication. */
    record ProfileResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String stageName,
            String firstName,
            String lastName,
            String bio,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            @Schema(requiredMode = REQUIRED) List<String> tags,
            @Schema(requiredMode = REQUIRED) Links links,
            Rate rate,
            @Schema(requiredMode = REQUIRED) int travelRadiusKm,
            @Schema(requiredMode = REQUIRED) SkillValues skills,
            Image avatar,
            @Schema(requiredMode = REQUIRED) List<Image> photos,
            Place location,
            @Schema(requiredMode = REQUIRED) boolean published,
            Instant publishedAt,
            @Schema(requiredMode = REQUIRED) List<Requirement> missingForPublication,
            @Schema(requiredMode = REQUIRED) Instant updatedAt) {
    }

    /** What anyone with the link sees: no real name, no coordinates. */
    record PublicProfileResponse(
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String stageName,
            String bio,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            @Schema(requiredMode = REQUIRED) List<String> tags,
            @Schema(requiredMode = REQUIRED) Links links,
            Rate rate,
            @Schema(requiredMode = REQUIRED) int travelRadiusKm,
            @Schema(requiredMode = REQUIRED) SkillValues skills,
            Image avatar,
            @Schema(requiredMode = REQUIRED) List<Image> photos,
            Place location,
            @Schema(requiredMode = REQUIRED) Instant publishedAt) {
    }
}
