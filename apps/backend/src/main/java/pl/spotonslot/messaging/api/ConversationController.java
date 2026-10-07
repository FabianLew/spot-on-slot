package pl.spotonslot.messaging.api;

import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.api.ConversationDtos.ConversationResponse;
import pl.spotonslot.messaging.api.ConversationDtos.MessagePageResponse;
import pl.spotonslot.messaging.api.ConversationDtos.MessageResponse;
import pl.spotonslot.messaging.api.ConversationDtos.ReadRequest;
import pl.spotonslot.messaging.api.ConversationDtos.SendMessageRequest;
import pl.spotonslot.messaging.api.ConversationDtos.StartConversationRequest;
import pl.spotonslot.messaging.api.ConversationDtos.UnreadCountResponse;
import pl.spotonslot.messaging.application.ConversationService;
import pl.spotonslot.shared.paging.PageQuery;
import pl.spotonslot.shared.paging.PageResponse;

/**
 * Conversations of the signed-in user: as the artist, or for the venues whose team they are in. Anybody else gets
 * 404. New messages and read receipts also arrive live over STOMP at {@code /ws} ({@code /user/queue/messages}).
 */
@RestController
@RequestMapping("/api/v1/conversations")
@PreAuthorize("hasAnyRole('ARTIST', 'VENUE')")
@RequiredArgsConstructor
class ConversationController {

    private final ConversationService conversations;

    /** Conversations with messages, latest activity first; {@code venueId} narrows to one of the caller's venues. */
    @GetMapping
    PageResponse<ConversationResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) UUID venueId, @Valid @ParameterObject PageQuery query) {
        var page = conversations.list(user(jwt), venueId, PageRequest.of(query.page() == null ? 0 : query.page(),
                query.size() == null ? 20 : query.size()));
        return PageResponse.from(page, page.getContent().stream().map(ConversationResponse::of).toList());
    }

    /** 201 when the conversation is new, 200 when the message went into the existing one. */
    @PostMapping
    ResponseEntity<ConversationResponse> start(@AuthenticationPrincipal Jwt jwt, Authentication authentication,
            @Valid @RequestBody StartConversationRequest request) {
        var started = conversations.start(user(jwt), side(authentication), request.venueId(), request.artistSlug(),
                request.venueSlug(), request.body(), request.clientId());
        return ResponseEntity.status(started.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(ConversationResponse.of(started.view()));
    }

    @GetMapping("/unread-count")
    UnreadCountResponse unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return UnreadCountResponse.of(conversations.unread(user(jwt)));
    }

    @GetMapping("/{id}")
    ConversationResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ConversationResponse.of(conversations.get(user(jwt), id));
    }

    /** Newest first, {@code size} at a time (1 to 50), older than {@code before} when given. */
    @GetMapping("/{id}/messages")
    MessagePageResponse messages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @RequestParam(required = false) UUID before,
            @RequestParam(defaultValue = "50") int size) {
        return MessagePageResponse.of(conversations.messages(user(jwt), id, before, size));
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    MessageResponse send(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody SendMessageRequest request) {
        return MessageResponse.of(conversations.send(user(jwt), id, request.body(), request.clientId()));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ReadRequest request) {
        conversations.read(user(jwt), id, request.messageId());
    }

    /** Blocks the other side of a direct conversation; booking threads cannot be blocked. */
    @PutMapping("/{id}/block")
    ConversationResponse block(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ConversationResponse.of(conversations.block(user(jwt), id));
    }

    /** Lifts the caller's side's block (a block by the other side stays). */
    @DeleteMapping("/{id}/block")
    ConversationResponse unblock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ConversationResponse.of(conversations.unblock(user(jwt), id));
    }

    private static ConversationSide side(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ARTIST".equals(authority.getAuthority()))
                ? ConversationSide.ARTIST : ConversationSide.VENUE;
    }

    private static UUID user(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
