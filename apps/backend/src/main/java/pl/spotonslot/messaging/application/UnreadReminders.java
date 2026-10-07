package pl.spotonslot.messaging.application;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.MessageUnread;
import pl.spotonslot.messaging.domain.Conversation;
import pl.spotonslot.messaging.domain.ReadState;
import pl.spotonslot.messaging.infrastructure.ConversationRepository;
import pl.spotonslot.messaging.infrastructure.MessageRepository;
import pl.spotonslot.messaging.infrastructure.ReadStateRepository;
import pl.spotonslot.venue.Venues;

/**
 * Reminds people of messages from the other side that have waited unread for 10 minutes: one {@link MessageUnread}
 * per person and conversation until they read it again, and none once somebody on their side has answered (the
 * conversation's newest message is their side's). The notification module sends the e-mail.
 */
@Service
@RequiredArgsConstructor
public class UnreadReminders {

    public static final Duration WAIT = Duration.ofMinutes(10);
    /** Older conversations are not looked at any more. */
    static final Duration LOOK_BACK = Duration.ofDays(3);

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final ReadStateRepository reads;
    private final ConversationService conversationService;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    /** Returns how many reminders were published. */
    @Transactional
    public int run() {
        var now = clock.instant();
        var due = now.minus(WAIT);
        var candidates = conversations.findByLastMessageAtAfter(now.minus(LOOK_BACK));
        if (candidates.isEmpty()) {
            return 0;
        }
        var teams = venues.teamsOf(candidates.stream().map(Conversation::getVenueId).collect(Collectors.toSet()));
        var states = reads.findByConversationIdIn(candidates.stream().map(Conversation::getId).toList()).stream()
                .collect(Collectors.groupingBy(ReadState::getConversationId,
                        Collectors.toMap(ReadState::getUserId, state -> state)));
        var published = 0;
        for (var conversation : candidates) {
            var newest = messages.findNewest(conversation.getId(), Limit.of(1));
            if (newest.isEmpty()) {
                continue;
            }
            var people = new LinkedHashMap<UUID, ConversationSide>();
            people.put(conversation.getArtistId(), ConversationSide.ARTIST);
            teams.getOrDefault(conversation.getVenueId(), Set.of())
                    .forEach(member -> people.putIfAbsent(member, ConversationSide.VENUE));
            for (var person : people.entrySet()) {
                var side = person.getValue();
                if (newest.getFirst().getSenderSide() == side) {
                    continue;
                }
                var state = states.getOrDefault(conversation.getId(), Map.of()).get(person.getKey());
                if (state != null && !state.isRemindable()) {
                    continue;
                }
                var readUpTo = state == null ? null : state.getReadUpTo();
                var oldestUnread = readUpTo == null
                        ? messages.findFirstByConversationIdAndSenderSideOrderByCreatedAtAscIdAsc(conversation.getId(),
                                side.other())
                        : messages.findFirstByConversationIdAndSenderSideAndCreatedAtAfterOrderByCreatedAtAscIdAsc(
                                conversation.getId(), side.other(), readUpTo);
                if (oldestUnread.isEmpty() || oldestUnread.get().getCreatedAt().isAfter(due)) {
                    continue;
                }
                conversationService.state(conversation.getId(), person.getKey()).reminded(now);
                events.publishEvent(new MessageUnread(conversation.getId(), person.getKey(), conversation.getKind(),
                        conversation.getBookingId(), senderName(conversation, side.other())));
                published++;
            }
        }
        return published;
    }

    private String senderName(Conversation conversation, ConversationSide sender) {
        if (sender == ConversationSide.ARTIST) {
            return artistProfiles.findPublishedByOwner(conversation.getArtistId())
                    .map(artist -> artist.stageName()).orElse(conversation.getArtistName());
        }
        return venues.findPublished(conversation.getVenueId()).map(venue -> venue.name())
                .orElse(conversation.getVenueName());
    }

}
