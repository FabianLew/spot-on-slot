package pl.spotonslot.moderation.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.ArtistModerationView;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.identity.AccountState;
import pl.spotonslot.identity.AdminAccount;
import pl.spotonslot.identity.Role;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.ListingModerationView;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.moderation.application.ModerationQueries;
import pl.spotonslot.moderation.application.Snapshot;
import pl.spotonslot.moderation.domain.ActionType;
import pl.spotonslot.moderation.domain.ModerationAction;
import pl.spotonslot.moderation.domain.Report;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ReportReason;
import pl.spotonslot.moderation.domain.ReportStatus;
import pl.spotonslot.moderation.infrastructure.ReportRepository;
import pl.spotonslot.venue.VenueModerationView;

/** Request and response shapes of reports and the admin panel. */
final class ModerationDtos {

    private ModerationDtos() {
    }

    /** ARTIST and VENUE: {@code slug}; LISTING and CONVERSATION: {@code id}. {@code description} needed for OTHER. */
    record ReportRequest(
            @NotNull @Schema(requiredMode = REQUIRED) ReportKind kind,
            @Size(max = 120) String slug,
            UUID id,
            @NotNull @Schema(requiredMode = REQUIRED) ReportReason reason,
            @Size(max = 1000) String description) {
    }

    record ReportCreated(@Schema(requiredMode = REQUIRED) UUID id, @Schema(requiredMode = REQUIRED) Instant createdAt) {
    }

    /** Why an admin acts (shown in the history and, for hiding, closing and blocking, to the owner). */
    record ReasonRequest(@NotBlank @Size(max = 500) @Schema(requiredMode = REQUIRED) String reason) {
    }

    record AdminInviteRequest(@NotBlank @Email @Size(max = 254) @Schema(requiredMode = REQUIRED) String email) {
    }

    @Schema(name = "ModerationOpenCount")
    record OpenCount(@Schema(requiredMode = REQUIRED) long reports, @Schema(requiredMode = REQUIRED) long targets) {

        static OpenCount of(ModerationQueries.OpenCount count) {
            return new OpenCount(count.reports(), count.targets());
        }
    }

    /** One reported thing in the queue: its open reports together. */
    record ReportTargetSummary(
            @Schema(requiredMode = REQUIRED) ReportKind kind,
            @Schema(requiredMode = REQUIRED) UUID targetId,
            @Schema(requiredMode = REQUIRED) String label,
            @Schema(requiredMode = REQUIRED) long openCount,
            @Schema(requiredMode = REQUIRED) Instant firstReportedAt,
            @Schema(requiredMode = REQUIRED) Instant lastReportedAt,
            @Schema(requiredMode = REQUIRED) List<ReportReason> reasons) {

        static ReportTargetSummary of(ReportRepository.TargetRow row) {
            return new ReportTargetSummary(ReportKind.valueOf(row.getKind()), row.getTargetId(), row.getLabel(),
                    row.getOpenCount(), row.getFirstAt(), row.getLastAt(),
                    Arrays.stream(row.getReasons().split(",")).map(ReportReason::valueOf).sorted().toList());
        }
    }

    @Schema(name = "ModerationArtist")
    record ArtistRef(
            @Schema(requiredMode = REQUIRED) UUID profileId,
            @Schema(requiredMode = REQUIRED) UUID ownerId,
            @Schema(requiredMode = REQUIRED) String slug,
            String stageName,
            @Schema(requiredMode = REQUIRED) boolean published,
            Instant hiddenAt,
            String hiddenReason) {

        static ArtistRef of(ArtistModerationView view) {
            return view == null ? null : new ArtistRef(view.profileId(), view.ownerId(), view.slug(),
                    view.stageName(), view.published(), view.hiddenAt(), view.hiddenReason());
        }
    }

    @Schema(name = "ModerationVenue")
    record VenueRef(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String name,
            String city,
            @Schema(requiredMode = REQUIRED) boolean published,
            Instant hiddenAt,
            String hiddenReason,
            @Schema(requiredMode = REQUIRED) List<UUID> team) {

        static VenueRef of(VenueModerationView view) {
            return view == null ? null : new VenueRef(view.id(), view.slug(), view.name(), view.city(),
                    view.published(), view.hiddenAt(), view.hiddenReason(), List.copyOf(view.team()));
        }
    }

    /** {@code status}: ACTIVE, CLOSED, EXPIRED or FILLED as of now. */
    @Schema(name = "ModerationListing")
    record ListingRef(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) ListingKind kind,
            @Schema(requiredMode = REQUIRED) String status,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            String description,
            Long priceFrom,
            Long priceTo,
            String city,
            Instant closedAt,
            String moderationReason,
            ArtistRef artist,
            VenueRef venue) {

        static ListingRef of(ListingModerationView view, ArtistModerationView artist, VenueModerationView venue) {
            return view == null ? null : new ListingRef(view.id(), view.kind(), view.status(), view.startsAt(),
                    view.endsAt(), view.genres(), view.description(), view.priceFrom(), view.priceTo(),
                    view.city(), view.closedAt(), view.moderationReason(), ArtistRef.of(artist),
                    VenueRef.of(venue));
        }
    }

    @Schema(name = "ModerationAccount")
    record AccountRef(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String email,
            @Schema(requiredMode = REQUIRED) Role role,
            @Schema(requiredMode = REQUIRED) AccountState state,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            Instant lastSignInAt,
            Instant blockedAt,
            String blockReason,
            Instant deletionRequestedAt) {

        static AccountRef of(AdminAccount account) {
            return new AccountRef(account.id(), account.email(), account.role(), account.state(),
                    account.createdAt(), account.lastSignInAt(), account.blockedAt(), account.blockReason(),
                    account.deletionRequestedAt());
        }
    }

    @Schema(name = "ReportedMessage")
    record SnapshotMessage(
            @Schema(requiredMode = REQUIRED) ConversationSide side,
            @Schema(requiredMode = REQUIRED, description = "Written by the reporter's side") boolean reporter,
            @Schema(requiredMode = REQUIRED) String body,
            @Schema(requiredMode = REQUIRED) boolean deleted,
            @Schema(requiredMode = REQUIRED) Instant createdAt) {
    }

    /** One report; {@code reporter} is null once their account was purged; {@code messages} for conversations. */
    record ReportItem(
            @Schema(requiredMode = REQUIRED) UUID id,
            UUID reporterId,
            String reporterEmail,
            @Schema(requiredMode = REQUIRED) ReportReason reason,
            String description,
            @Schema(requiredMode = REQUIRED) ReportStatus status,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            Instant resolvedAt,
            String resolutionNote,
            List<SnapshotMessage> messages) {

        static ReportItem of(Report report, String reporterEmail, Snapshot snapshot) {
            return new ReportItem(report.getId(), report.getReporterId(), reporterEmail, report.getReason(),
                    report.getDescription(), report.getStatus(), report.getCreatedAt(), report.getResolvedAt(),
                    report.getResolutionNote(), snapshot == null ? null : snapshot.messages().stream()
                            .map(message -> new SnapshotMessage(message.side(), message.reporter(),
                                    message.body() == null ? "" : message.body(), message.deleted(),
                                    message.createdAt()))
                            .toList());
        }
    }

    @Schema(name = "ModerationActionEntry")
    record ActionItem(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            @Schema(requiredMode = REQUIRED) UUID adminId,
            @Schema(requiredMode = REQUIRED) String adminEmail,
            @Schema(requiredMode = REQUIRED) ActionType type,
            ReportKind kind,
            UUID targetId,
            UUID subjectId,
            @Schema(requiredMode = REQUIRED) String subjectLabel,
            String reason) {

        static ActionItem of(ModerationAction action) {
            return new ActionItem(action.getId(), action.getCreatedAt(), action.getAdminId(),
                    action.getAdminEmail(), action.getType(), action.getKind(), action.getTargetId(),
                    action.getSubjectId(), action.getSubjectLabel(), action.getReason());
        }
    }

    /** A reported thing as it is now, with every report of it and what admins did about it. */
    record ReportTargetDetail(
            @Schema(requiredMode = REQUIRED) ReportKind kind,
            @Schema(requiredMode = REQUIRED) UUID targetId,
            @Schema(requiredMode = REQUIRED) String label,
            @Schema(description = "ARTIST; missing once deleted") ArtistRef artist,
            @Schema(description = "VENUE; missing once deleted") VenueRef venue,
            @Schema(description = "LISTING; missing once deleted") ListingRef listing,
            @Schema(requiredMode = REQUIRED) List<AccountRef> owners,
            @Schema(requiredMode = REQUIRED) List<ReportItem> reports,
            @Schema(requiredMode = REQUIRED) List<ActionItem> actions) {
    }

    @Schema(name = "AdminUser")
    record UserItem(
            @Schema(requiredMode = REQUIRED) AccountRef account,
            ArtistRef artist,
            @Schema(requiredMode = REQUIRED) List<VenueRef> venues,
            @Schema(requiredMode = REQUIRED) long reportsTotal,
            @Schema(requiredMode = REQUIRED) long reportsOpen) {

        static UserItem of(ModerationQueries.UserView view) {
            return new UserItem(AccountRef.of(view.account()), ArtistRef.of(view.artist()),
                    view.venues().stream().map(VenueRef::of).toList(), view.reportsTotal(), view.reportsOpen());
        }
    }

    @Schema(name = "AdminUserDetail")
    record UserDetail(
            @Schema(requiredMode = REQUIRED) UserItem user,
            @Schema(requiredMode = REQUIRED) List<ActionItem> actions) {
    }

    /** A report as its sender gets it in the data export. */
    record SentReport(UUID id, ReportKind kind, String label, ReportReason reason, String description,
            ReportStatus status, Instant createdAt) {

        static SentReport of(Report report) {
            return new SentReport(report.getId(), report.getKind(), report.getLabel(), report.getReason(),
                    report.getDescription(), report.getStatus(), report.getCreatedAt());
        }
    }
}
