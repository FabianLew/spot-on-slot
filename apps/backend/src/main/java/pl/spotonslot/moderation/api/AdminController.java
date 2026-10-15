package pl.spotonslot.moderation.api;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.identity.AccountState;
import pl.spotonslot.identity.Role;
import pl.spotonslot.moderation.api.ModerationDtos.AccountRef;
import pl.spotonslot.moderation.api.ModerationDtos.ActionItem;
import pl.spotonslot.moderation.api.ModerationDtos.AdminInviteRequest;
import pl.spotonslot.moderation.api.ModerationDtos.ArtistRef;
import pl.spotonslot.moderation.api.ModerationDtos.ListingRef;
import pl.spotonslot.moderation.api.ModerationDtos.OpenCount;
import pl.spotonslot.moderation.api.ModerationDtos.ReasonRequest;
import pl.spotonslot.moderation.api.ModerationDtos.ReportItem;
import pl.spotonslot.moderation.api.ModerationDtos.ReportTargetDetail;
import pl.spotonslot.moderation.api.ModerationDtos.ReportTargetSummary;
import pl.spotonslot.moderation.api.ModerationDtos.UserDetail;
import pl.spotonslot.moderation.api.ModerationDtos.UserItem;
import pl.spotonslot.moderation.api.ModerationDtos.VenueRef;
import pl.spotonslot.moderation.application.ModerationQueries;
import pl.spotonslot.moderation.application.ModerationService;
import pl.spotonslot.moderation.application.ReportService;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ModerationErrors;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;

/** The admin panel: the report queue, actions on profiles, venues, listings and accounts, the history, admins. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
class AdminController {

    private static final Sort UNSORTED = Sort.unsorted();

    private final ModerationQueries queries;
    private final ModerationService moderation;
    private final ReportService reports;

    // ---- reports

    /** Reported things with open reports, the longest waiting first; {@code kind} narrows. */
    @GetMapping("/reports")
    PageResponse<ReportTargetSummary> reports(@RequestParam(required = false) ReportKind kind,
            @Valid @ParameterObject PageQuery query) {
        var page = queries.openTargets(kind, query.toPageable(Set.of(), UNSORTED));
        return PageResponse.from(page, page.getContent().stream().map(ReportTargetSummary::of).toList());
    }

    @GetMapping("/reports/count")
    OpenCount openCount() {
        return OpenCount.of(queries.openCount());
    }

    @GetMapping("/reports/{kind}/{targetId}")
    ReportTargetDetail target(@PathVariable ReportKind kind, @PathVariable UUID targetId) {
        var detail = queries.target(kind, targetId);
        var items = detail.reports().stream()
                .map(report -> ReportItem.of(report, detail.reporterEmails().get(report.getReporterId()),
                        reports.snapshot(report.getSnapshot())))
                .toList();
        return new ReportTargetDetail(detail.kind(), detail.targetId(), detail.label(), ArtistRef.of(detail.artist()),
                VenueRef.of(detail.venue()),
                ListingRef.of(detail.listing(), detail.listingArtist(), detail.listingVenue()),
                detail.owners().stream().map(AccountRef::of).toList(), items,
                detail.actions().stream().map(ActionItem::of).toList());
    }

    /** Closes the open reports of the thing as "nothing wrong", with a note for other admins. */
    @PostMapping("/reports/{kind}/{targetId}/dismiss")
    ReportTargetDetail dismiss(@AuthenticationPrincipal Jwt jwt, @PathVariable ReportKind kind,
            @PathVariable UUID targetId, @Valid @RequestBody ReasonRequest request) {
        moderation.dismiss(admin(jwt), kind, targetId, request.reason());
        return target(kind, targetId);
    }

    // ---- profiles, venues, listings

    @PostMapping("/artists/{profileId}/hide")
    ArtistRef hideArtist(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID profileId,
            @Valid @RequestBody ReasonRequest request) {
        return ArtistRef.of(moderation.hideArtist(admin(jwt), profileId, request.reason()));
    }

    @PostMapping("/artists/{profileId}/restore")
    ArtistRef restoreArtist(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID profileId,
            @Valid @RequestBody ReasonRequest request) {
        return ArtistRef.of(moderation.restoreArtist(admin(jwt), profileId, request.reason()));
    }

    @PostMapping("/venues/{venueId}/hide")
    VenueRef hideVenue(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID venueId,
            @Valid @RequestBody ReasonRequest request) {
        return VenueRef.of(moderation.hideVenue(admin(jwt), venueId, request.reason()));
    }

    @PostMapping("/venues/{venueId}/restore")
    VenueRef restoreVenue(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID venueId,
            @Valid @RequestBody ReasonRequest request) {
        return VenueRef.of(moderation.restoreVenue(admin(jwt), venueId, request.reason()));
    }

    @PostMapping("/listings/{listingId}/close")
    ListingRef closeListing(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID listingId,
            @Valid @RequestBody ReasonRequest request) {
        return ListingRef.of(moderation.closeListing(admin(jwt), listingId, request.reason()), null, null);
    }

    // ---- accounts

    /** Accounts by e-mail, stage name or venue name ({@code q}), role and state, newest first. */
    @GetMapping("/users")
    PageResponse<UserItem> users(@RequestParam(required = false) String q,
            @RequestParam(required = false) Role role, @RequestParam(required = false) AccountState state,
            @Valid @ParameterObject PageQuery query) {
        var page = queries.users(q, role, state, query.toPageable(Set.of(), UNSORTED));
        return PageResponse.from(page, page.getContent().stream().map(UserItem::of).toList());
    }

    @GetMapping("/users/{userId}")
    UserDetail user(@PathVariable UUID userId) {
        var detail = queries.user(userId);
        return new UserDetail(UserItem.of(detail.user()), detail.actions().stream().map(ActionItem::of).toList());
    }

    /** Signs the account out everywhere, keeps it from signing in and hides what others see of it. */
    @PostMapping("/users/{userId}/block")
    UserItem block(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId,
            @Valid @RequestBody ReasonRequest request) {
        moderation.block(admin(jwt), userId, request.reason());
        return userItem(userId);
    }

    /** Lets the account sign in again; its profile and venues stay unpublished. */
    @PostMapping("/users/{userId}/unblock")
    UserItem unblock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId,
            @Valid @RequestBody ReasonRequest request) {
        moderation.unblock(admin(jwt), userId, request.reason());
        return userItem(userId);
    }

    // ---- history and admins

    @GetMapping("/actions")
    PageResponse<ActionItem> actions(@Valid @ParameterObject PageQuery query) {
        var page = queries.actions(query.toPageable(Set.of(), UNSORTED));
        return PageResponse.from(page, page.getContent().stream().map(ActionItem::of).toList());
    }

    @GetMapping("/admins")
    List<AccountRef> admins() {
        return queries.admins().stream().map(AccountRef::of).toList();
    }

    /** Creates an admin account and e-mails it a link that sets its password (valid 3 days). */
    @PostMapping("/admins")
    @ResponseStatus(HttpStatus.CREATED)
    AccountRef addAdmin(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AdminInviteRequest request) {
        return AccountRef.of(moderation.addAdmin(admin(jwt), request.email()));
    }

    private UserItem userItem(UUID userId) {
        return queries.userView(userId).map(UserItem::of).orElseThrow(ModerationErrors.TargetNotFound::new);
    }

    private static UUID admin(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
