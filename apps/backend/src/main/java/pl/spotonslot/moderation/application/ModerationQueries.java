package pl.spotonslot.moderation.application;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistModerationView;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.identity.AccountAdministration;
import pl.spotonslot.identity.AccountState;
import pl.spotonslot.identity.AdminAccount;
import pl.spotonslot.identity.Role;
import pl.spotonslot.listing.ListingModerationView;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.moderation.domain.ModerationAction;
import pl.spotonslot.moderation.domain.ModerationErrors;
import pl.spotonslot.moderation.domain.Report;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ReportStatus;
import pl.spotonslot.moderation.infrastructure.ModerationActionRepository;
import pl.spotonslot.moderation.infrastructure.ReportRepository;
import pl.spotonslot.venue.VenueModerationView;
import pl.spotonslot.venue.Venues;

/** What the admin panel reads: the report queue, reported things, accounts and the history. */
@Service
@RequiredArgsConstructor
public class ModerationQueries {

    /** Stands in for an empty list in {@code IN (...)}. */
    private static final List<UUID> NONE = List.of(new UUID(0, 0));

    private final ReportRepository reports;
    private final ModerationActionRepository actions;
    private final AccountAdministration accounts;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Listings listings;

    /** Counts for the menu badge. */
    public record OpenCount(long reports, long targets) {
    }

    /** A reported thing as it is now: exactly one of {@code artist}, {@code venue}, {@code listing} for its kind. */
    public record TargetDetail(ReportKind kind, UUID targetId, String label, ArtistModerationView artist,
            VenueModerationView venue, ListingModerationView listing, ArtistModerationView listingArtist,
            VenueModerationView listingVenue, List<AdminAccount> owners, List<Report> reports,
            Map<UUID, String> reporterEmails, List<ModerationAction> actions) {
    }

    /** An account with what it runs and how often it was reported. */
    public record UserView(AdminAccount account, ArtistModerationView artist, List<VenueModerationView> venues,
            long reportsTotal, long reportsOpen) {
    }

    public record UserDetail(UserView user, List<ModerationAction> actions) {
    }

    @Transactional(readOnly = true)
    public Page<ReportRepository.TargetRow> openTargets(ReportKind kind, Pageable pageable) {
        return reports.findOpenTargets(kind == null ? null : kind.name(), pageable);
    }

    @Transactional(readOnly = true)
    public OpenCount openCount() {
        return new OpenCount(reports.countByStatus(ReportStatus.OPEN),
                reports.findOpenTargets(null, Pageable.ofSize(1)).getTotalElements());
    }

    /** @throws ModerationErrors.TargetNotFound when nothing of the kind was ever reported under that id */
    @Transactional(readOnly = true)
    public TargetDetail target(ReportKind kind, UUID targetId) {
        var all = reports.findByKindAndTargetIdOrderByCreatedAtDesc(kind, targetId);
        if (all.isEmpty()) {
            throw new ModerationErrors.TargetNotFound();
        }
        ArtistModerationView artist = null;
        VenueModerationView venue = null;
        ListingModerationView listing = null;
        ArtistModerationView listingArtist = null;
        VenueModerationView listingVenue = null;
        var owners = new LinkedHashSet<UUID>();
        switch (kind) {
            case ARTIST -> {
                artist = artistProfiles.findForModeration(targetId).orElse(null);
                if (artist != null) {
                    owners.add(artist.ownerId());
                }
            }
            case VENUE -> {
                venue = venues.findForModeration(targetId).orElse(null);
                if (venue != null) {
                    owners.addAll(venue.team());
                }
            }
            case LISTING -> {
                listing = listings.findForModeration(targetId).orElse(null);
                if (listing != null && listing.artistId() != null) {
                    listingArtist = artistProfiles.findForModerationByOwner(listing.artistId()).orElse(null);
                    owners.add(listing.artistId());
                } else if (listing != null) {
                    listingVenue = venues.findForModeration(listing.venueId()).orElse(null);
                    if (listingVenue != null) {
                        owners.addAll(listingVenue.team());
                    }
                }
            }
            case CONVERSATION -> owners.addAll(all.getFirst().owners());
        }
        var emails = new HashMap<UUID, String>();
        all.stream().map(Report::getReporterId).filter(id -> id != null).distinct()
                .forEach(id -> accounts.find(id).ifPresent(account -> emails.put(id, account.email())));
        var ownerAccounts = owners.stream().flatMap(id -> accounts.find(id).stream()).toList();
        return new TargetDetail(kind, targetId, all.getFirst().getLabel(), artist, venue, listing, listingArtist,
                listingVenue, ownerAccounts, all, emails,
                actions.findByKindAndTargetIdOrderByCreatedAtDescIdDesc(kind, targetId));
    }

    /** Accounts by e-mail, stage name or venue name ({@code query}), role and state, newest first. */
    @Transactional(readOnly = true)
    public Page<UserView> users(String query, Role role, AccountState state, Pageable pageable) {
        var matching = new LinkedHashSet<UUID>();
        if (query != null && !query.isBlank()) {
            matching.addAll(artistProfiles.ownersNamed(query.strip()));
            venues.namedForModeration(query.strip()).forEach(venue -> matching.addAll(venue.team()));
        }
        var page = accounts.search(query, matching, role, state, pageable);
        var counts = counts(page.getContent().stream().map(AdminAccount::id).toList());
        return page.map(account -> view(account, counts));
    }

    @Transactional(readOnly = true)
    public UserDetail user(UUID userId) {
        var account = accounts.find(userId).orElseThrow(ModerationErrors.TargetNotFound::new);
        var view = view(account, counts(List.of(userId)));
        var targets = new ArrayList<UUID>();
        if (view.artist() != null) {
            targets.add(view.artist().profileId());
        }
        view.venues().forEach(venue -> targets.add(venue.id()));
        return new UserDetail(view, actions.findAbout(userId, targets.isEmpty() ? NONE : targets));
    }

    @Transactional(readOnly = true)
    public Optional<UserView> userView(UUID userId) {
        return accounts.find(userId).map(account -> view(account, counts(List.of(userId))));
    }

    @Transactional(readOnly = true)
    public Page<ModerationAction> actions(Pageable pageable) {
        return actions.findAllByOrderByCreatedAtDescIdDesc(pageable);
    }

    public List<AdminAccount> admins() {
        return accounts.admins();
    }

    private UserView view(AdminAccount account, Map<UUID, ReportRepository.OwnerCount> counts) {
        var count = counts.get(account.id());
        var artist = account.role() == Role.ARTIST
                ? artistProfiles.findForModerationByOwner(account.id()).orElse(null) : null;
        var managed = account.role() == Role.VENUE ? venues.managedForModeration(account.id())
                : List.<VenueModerationView>of();
        return new UserView(account, artist, managed, count == null ? 0 : count.getTotal(),
                count == null ? 0 : count.getOpen());
    }

    private Map<UUID, ReportRepository.OwnerCount> counts(List<UUID> userIds) {
        var result = new HashMap<UUID, ReportRepository.OwnerCount>();
        if (!userIds.isEmpty()) {
            reports.countOwnedBy(userIds).forEach(row -> result.put(row.getUserId(), row));
        }
        return result;
    }
}
