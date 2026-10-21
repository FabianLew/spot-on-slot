package pl.spotonslot.moderation.application;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistModerationView;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.identity.AccountAdministration;
import pl.spotonslot.identity.AdminAccount;
import pl.spotonslot.identity.Role;
import pl.spotonslot.listing.ListingModerationView;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.moderation.domain.ActionType;
import pl.spotonslot.moderation.domain.ModerationAction;
import pl.spotonslot.moderation.domain.ModerationErrors;
import pl.spotonslot.moderation.domain.Report;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ReportStatus;
import pl.spotonslot.moderation.infrastructure.ModerationActionRepository;
import pl.spotonslot.moderation.infrastructure.ReportRepository;
import pl.spotonslot.venue.VenueModerationView;
import pl.spotonslot.venue.Venues;

/**
 * What admins do. Every action is written to the history; hiding, closing and blocking also resolve the open reports
 * of what they act on (a block: of everything the account owned).
 */
@Service
@RequiredArgsConstructor
public class ModerationService {

    private final AccountAdministration accounts;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Listings listings;
    private final ReportRepository reports;
    private final ModerationActionRepository actions;
    private final Clock clock;

    @Transactional
    public ArtistModerationView hideArtist(UUID adminId, UUID profileId, String reason) {
        var profile = artist(profileId);
        artistProfiles.hideByModeration(profileId, reason);
        record(adminId, ActionType.HIDE, ReportKind.ARTIST, profileId, profile.ownerId(), profile.stageName(),
                reason);
        resolve(adminId, reports.findByKindAndTargetIdAndStatus(ReportKind.ARTIST, profileId, ReportStatus.OPEN),
                reason);
        return artist(profileId);
    }

    /** @throws ModerationErrors.NotHidden when the profile is not hidden */
    @Transactional
    public ArtistModerationView restoreArtist(UUID adminId, UUID profileId, String reason) {
        var profile = artist(profileId);
        if (profile.hiddenAt() == null) {
            throw new ModerationErrors.NotHidden();
        }
        artistProfiles.restoreByModeration(profileId);
        record(adminId, ActionType.RESTORE, ReportKind.ARTIST, profileId, profile.ownerId(), profile.stageName(),
                reason);
        return artist(profileId);
    }

    @Transactional
    public VenueModerationView hideVenue(UUID adminId, UUID venueId, String reason) {
        var venue = venue(venueId);
        venues.hideByModeration(venueId, reason);
        record(adminId, ActionType.HIDE, ReportKind.VENUE, venueId, null, venue.name(), reason);
        resolve(adminId, reports.findByKindAndTargetIdAndStatus(ReportKind.VENUE, venueId, ReportStatus.OPEN),
                reason);
        return venue(venueId);
    }

    /** @throws ModerationErrors.NotHidden when the venue is not hidden */
    @Transactional
    public VenueModerationView restoreVenue(UUID adminId, UUID venueId, String reason) {
        var venue = venue(venueId);
        if (venue.hiddenAt() == null) {
            throw new ModerationErrors.NotHidden();
        }
        venues.restoreByModeration(venueId);
        record(adminId, ActionType.RESTORE, ReportKind.VENUE, venueId, null, venue.name(), reason);
        return venue(venueId);
    }

    /** @throws ModerationErrors.AlreadyClosed when the listing has already ended */
    @Transactional
    public ListingModerationView closeListing(UUID adminId, UUID listingId, String reason) {
        var listing = listing(listingId);
        if (!listings.closeByModeration(listingId, reason)) {
            throw new ModerationErrors.AlreadyClosed();
        }
        record(adminId, ActionType.CLOSE_LISTING, ReportKind.LISTING, listingId, listing.artistId(),
                listingLabel(listing), reason);
        resolve(adminId, reports.findByKindAndTargetIdAndStatus(ReportKind.LISTING, listingId, ReportStatus.OPEN),
                reason);
        return listing(listingId);
    }

    @Transactional
    public AdminAccount block(UUID adminId, UUID userId, String reason) {
        var wasBlocked = accounts.find(userId).map(account -> account.blockedAt() != null).orElse(false);
        var account = accounts.block(adminId, userId, reason);
        if (!wasBlocked) {
            record(adminId, ActionType.BLOCK_ACCOUNT, null, null, userId, account.email(), reason);
            resolve(adminId, reports.findOpenOwnedBy(userId), reason);
        }
        return account;
    }

    @Transactional
    public AdminAccount unblock(UUID adminId, UUID userId, String reason) {
        var wasBlocked = accounts.find(userId).map(account -> account.blockedAt() != null).orElse(false);
        var account = accounts.unblock(adminId, userId);
        if (wasBlocked) {
            record(adminId, ActionType.UNBLOCK_ACCOUNT, null, null, userId, account.email(), reason);
        }
        return account;
    }

    /** Closes the open reports of the thing as "nothing wrong"; returns how many. */
    @Transactional
    public int dismiss(UUID adminId, ReportKind kind, UUID targetId, String note) {
        var open = reports.findByKindAndTargetIdAndStatus(kind, targetId, ReportStatus.OPEN);
        if (open.isEmpty()) {
            throw new ModerationErrors.TargetNotFound();
        }
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        open.forEach(report -> report.close(ReportStatus.DISMISSED, adminId, note, now));
        record(adminId, ActionType.DISMISS_REPORTS, kind, targetId, null, open.getFirst().getLabel(), note);
        return open.size();
    }

    @Transactional
    public AdminAccount addAdmin(UUID adminId, String email) {
        var admin = accounts.inviteAdmin(email);
        record(adminId, ActionType.ADD_ADMIN, null, null, admin.id(), admin.email(), null);
        return admin;
    }

    public static String listingLabel(ListingModerationView listing, ArtistProfiles artists, Venues venues) {
        if (listing.artistId() != null) {
            return artists.findForModerationByOwner(listing.artistId()).map(ArtistModerationView::stageName)
                    .orElse(ReportService.DELETED_NAME);
        }
        return venues.findForModeration(listing.venueId()).map(VenueModerationView::name)
                .orElse(ReportService.DELETED_NAME);
    }

    private String listingLabel(ListingModerationView listing) {
        return listingLabel(listing, artistProfiles, venues);
    }

    private void resolve(UUID adminId, List<Report> open, String note) {
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        open.forEach(report -> report.close(ReportStatus.RESOLVED, adminId, note, now));
    }

    private void record(UUID adminId, ActionType type, ReportKind kind, UUID targetId, UUID subjectId,
            String subjectLabel, String reason) {
        var admin = accounts.find(adminId).filter(account -> account.role() == Role.ADMIN)
                .orElseThrow(() -> new IllegalStateException("Acting account is not an admin: " + adminId));
        actions.save(ModerationAction.of(adminId, admin.email(), type, kind, targetId, subjectId,
                subjectLabel == null ? "" : subjectLabel, reason));
    }

    private ArtistModerationView artist(UUID profileId) {
        return artistProfiles.findForModeration(profileId).orElseThrow(ModerationErrors.TargetNotFound::new);
    }

    private VenueModerationView venue(UUID venueId) {
        return venues.findForModeration(venueId).orElseThrow(ModerationErrors.TargetNotFound::new);
    }

    private ListingModerationView listing(UUID listingId) {
        return listings.findForModeration(listingId).orElseThrow(ModerationErrors.TargetNotFound::new);
    }
}
