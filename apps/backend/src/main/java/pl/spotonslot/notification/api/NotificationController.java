package pl.spotonslot.notification.api;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.notification.api.NotificationDtos.NotificationResponse;
import pl.spotonslot.notification.api.NotificationDtos.PreferencesRequest;
import pl.spotonslot.notification.api.NotificationDtos.PreferencesResponse;
import pl.spotonslot.notification.api.NotificationDtos.UnreadCountResponse;
import pl.spotonslot.notification.application.NotificationService;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;

/** The signed-in user's notifications (newest first, kept 90 days) and their settings. */
@RestController
@RequestMapping("/api/v1/notifications")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
class NotificationController {

    /** Always newest first; {@code sort} is refused. */
    private static final Set<String> SORTABLE = Set.of();

    private final NotificationService notifications;

    @GetMapping
    PageResponse<NotificationResponse> notifications(@AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject PageQuery query) {
        var page = notifications.list(user(jwt), query.toPageable(SORTABLE, Sort.unsorted()));
        return PageResponse.from(page, page.getContent().stream().map(NotificationResponse::of).toList());
    }

    @GetMapping("/unread-count")
    UnreadCountResponse unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return new UnreadCountResponse(notifications.unreadCount(user(jwt)));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        notifications.markRead(user(jwt), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markAllRead(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(user(jwt));
    }

    @GetMapping("/preferences")
    PreferencesResponse notificationPreferences(@AuthenticationPrincipal Jwt jwt) {
        return PreferencesResponse.of(notifications.settings(user(jwt)));
    }

    /** Replaces the settings; e-mails of the account itself (verification, password reset) are not affected. */
    @PutMapping("/preferences")
    PreferencesResponse updateNotificationPreferences(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PreferencesRequest request) {
        var nearby = request.nearbyListings();
        return PreferencesResponse.of(notifications.update(user(jwt), nearby.enabled(), nearby.email(),
                nearby.radiusKm(), nearby.genres() == null ? List.of() : nearby.genres(),
                request.messages() == null ? null : request.messages().email()));
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
