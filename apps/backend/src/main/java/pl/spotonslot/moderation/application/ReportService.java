package pl.spotonslot.moderation.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.messaging.ConversationReport;
import pl.spotonslot.messaging.Conversations;
import pl.spotonslot.moderation.domain.ModerationErrors;
import pl.spotonslot.moderation.domain.Report;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ReportReason;
import pl.spotonslot.moderation.domain.ReportStatus;
import pl.spotonslot.moderation.infrastructure.ReportRepository;
import pl.spotonslot.venue.Venues;

/**
 * Reports from users. A report freezes who the thing belonged to and its name, and for a conversation a copy of its
 * newest messages; the reporter is never told the outcome.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    public static final int MAX_PER_DAY = 10;
    public static final int SNAPSHOT_SIZE = 20;
    public static final String DELETED_NAME = "Usunięte konto";
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final long LOCK_SALT = 0x6d6f6465726174L;

    private final ReportRepository reports;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Listings listings;
    private final Conversations conversations;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    /** The reported thing as it is now. */
    private record Resolved(UUID id, Set<UUID> owners, String label, String snapshot) {
    }

    /**
     * Stores a report of something the reporter can see.
     *
     * @throws ModerationErrors.TargetNotFound when it does not exist or is not visible to them
     * @throws ModerationErrors.OwnTarget for their own profile, venue or listing
     * @throws ModerationErrors.AlreadyReported while their earlier report of it is open
     * @throws ModerationErrors.ReportLimit after {@value #MAX_PER_DAY} reports in a Warsaw day
     */
    @Transactional
    public Report report(UUID reporterId, ReportTarget target, ReportReason reason, String description) {
        var text = description == null || description.isBlank() ? null : description.strip();
        if (reason == ReportReason.OTHER && text == null) {
            throw new ModerationErrors.DescriptionRequired();
        }
        var resolved = resolve(reporterId, target);
        if (resolved.owners().contains(reporterId)) {
            throw new ModerationErrors.OwnTarget();
        }
        // One report at a time per person, so the daily limit holds under parallel requests.
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                reporterId.getMostSignificantBits() ^ reporterId.getLeastSignificantBits() ^ LOCK_SALT);
        if (reports.existsByReporterIdAndKindAndTargetIdAndStatus(reporterId, target.kind(), resolved.id(),
                ReportStatus.OPEN)) {
            throw new ModerationErrors.AlreadyReported();
        }
        var dayStart = LocalDate.now(clock.withZone(WARSAW)).atStartOfDay(WARSAW).toInstant();
        if (reports.countByReporterIdAndCreatedAtGreaterThanEqual(reporterId, dayStart) >= MAX_PER_DAY) {
            throw new ModerationErrors.ReportLimit();
        }
        try {
            return reports.saveAndFlush(Report.open(reporterId, target.kind(), resolved.id(), resolved.owners(),
                    resolved.label(), reason, text, resolved.snapshot()));
        } catch (DataIntegrityViolationException e) {
            throw new ModerationErrors.AlreadyReported();
        }
    }

    /** The reports the person sent, newest first, for their data export. */
    @Transactional(readOnly = true)
    public List<Report> sentBy(UUID userId) {
        return reports.findByReporterIdOrderByCreatedAtDesc(userId);
    }

    /**
     * After an account is purged: its reports stay without it (and its side of conversation copies is erased), it
     * leaves the owners of reported things, and things only it owned are named {@value #DELETED_NAME}.
     */
    @Transactional
    public void forget(UUID userId) {
        for (var report : reports.findByReporterIdOrderByCreatedAtDesc(userId)) {
            report.forgetReporter(withoutReporter(report.getSnapshot()));
        }
        reports.flush();
        reports.forgetOwner(userId, DELETED_NAME);
    }

    @Transactional
    public void forgetVenues(Set<UUID> venueIds) {
        if (!venueIds.isEmpty()) {
            reports.forgetVenues(List.copyOf(venueIds), DELETED_NAME);
        }
    }

    public Snapshot snapshot(String json) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Snapshot.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unreadable report snapshot", e);
        }
    }

    private Resolved resolve(UUID reporterId, ReportTarget target) {
        return switch (target.kind()) {
            case ARTIST -> artistProfiles.findPublishedForModeration(slug(target))
                    .map(view -> new Resolved(view.profileId(), Set.of(view.ownerId()), view.stageName(), null))
                    .orElseThrow(ModerationErrors.TargetNotFound::new);
            case VENUE -> venues.findPublishedForModeration(slug(target))
                    .map(view -> new Resolved(view.id(), Set.copyOf(view.team()), view.name(), null))
                    .orElseThrow(ModerationErrors.TargetNotFound::new);
            case LISTING -> listing(id(target));
            case CONVERSATION -> conversations.reportOf(reporterId, id(target), SNAPSHOT_SIZE)
                    .map(copy -> new Resolved(copy.conversationId(), copy.otherSide(), copy.otherName(),
                            json(new Snapshot(copy.messages()))))
                    .orElseThrow(ModerationErrors.TargetNotFound::new);
        };
    }

    /** An active listing whose author is published, as on its public page. */
    private Resolved listing(UUID listingId) {
        var listing = listings.findForModeration(listingId).filter(view -> "ACTIVE".equals(view.status()))
                .orElseThrow(ModerationErrors.TargetNotFound::new);
        if (listing.kind() == ListingKind.ARTIST_AVAILABLE) {
            var artist = artistProfiles.findPublishedByOwner(listing.artistId())
                    .orElseThrow(ModerationErrors.TargetNotFound::new);
            return new Resolved(listing.id(), Set.of(listing.artistId()), artist.stageName(), null);
        }
        var venue = venues.findForModeration(listing.venueId()).filter(view -> view.published())
                .orElseThrow(ModerationErrors.TargetNotFound::new);
        return new Resolved(listing.id(), Set.copyOf(venue.team()), venue.name(), null);
    }

    private static String slug(ReportTarget target) {
        if (target.slug() == null || target.slug().isBlank()) {
            throw new ModerationErrors.TargetRequired("slug");
        }
        return target.slug().strip();
    }

    private static UUID id(ReportTarget target) {
        if (target.id() == null) {
            throw new ModerationErrors.TargetRequired("id");
        }
        return target.id();
    }

    private String withoutReporter(String json) {
        var snapshot = snapshot(json);
        if (snapshot == null) {
            return null;
        }
        return json(new Snapshot(snapshot.messages().stream()
                .map(message -> message.reporter()
                        ? new ConversationReport.Message(message.side(), true, "", true, message.createdAt())
                        : message)
                .toList()));
    }

    private String json(Snapshot snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot write report snapshot", e);
        }
    }
}
