package pl.spotonslot.messaging.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistCard;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.booking.BookingInfo;
import pl.spotonslot.booking.Bookings;
import pl.spotonslot.media.MediaImage;
import pl.spotonslot.media.MediaLibrary;
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.domain.Conversation;
import pl.spotonslot.messaging.domain.ConversationMessage;
import pl.spotonslot.messaging.domain.MessagingErrors;
import pl.spotonslot.messaging.domain.ReadState;
import pl.spotonslot.messaging.infrastructure.ConversationRepository;
import pl.spotonslot.messaging.infrastructure.MessageRepository;
import pl.spotonslot.messaging.infrastructure.ReadStateRepository;
import pl.spotonslot.shared.persistence.UuidV7;
import pl.spotonslot.venue.VenueCard;
import pl.spotonslot.venue.Venues;

/**
 * Conversations of the signed-in person: as the artist, or for the venues whose team they are in. Anybody else gets
 * 404. Sends run under the sender's lock (limits, retries) and a new direct conversation under its pair's lock.
 */
@Service
@RequiredArgsConstructor
public class ConversationService {

    public static final int MAX_NEW_PER_DAY = 20;
    public static final int MAX_PER_MINUTE = 30;
    public static final int MAX_PAGE = 50;
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    /** Stands in for an empty list in {@code IN (...)}, which SQL does not allow empty. */
    private static final List<UUID> NONE = List.of(new UUID(0, 0));
    private static final long SENDER_SALT = 0x4d534753L;
    private static final long PAIR_SALT = 0x50414952L;

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final ReadStateRepository reads;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final MediaLibrary media;
    private final Bookings bookings;
    private final LivePush push;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    /** A conversation as returned after starting it; {@code created} = it did not exist before. */
    public record Started(ConversationView view, boolean created) {
    }

    // ---- writing

    /**
     * Starts the direct conversation of an artist and a venue with a first message, or writes in it if it exists.
     * An artist names the venue by {@code venueSlug}; a venue's team member names the artist by {@code artistSlug}
     * and their venue by {@code venueId}. Both sides must be published.
     */
    @Transactional
    public Started start(UUID userId, ConversationSide side, UUID venueId, String artistSlug, String venueSlug,
            String body, String clientId) {
        UUID artistId;
        UUID venue;
        String artistName;
        String venueName;
        if (side == ConversationSide.ARTIST) {
            if (venueSlug == null || artistSlug != null) {
                throw new MessagingErrors.RequestInvalid();
            }
            var artist = artistProfiles.findPublishedByOwner(userId).orElseThrow(MessagingErrors.NotPublished::new);
            var recipient = venues.findPublishedBySlug(venueSlug).orElseThrow(MessagingErrors.RecipientNotFound::new);
            artistId = userId;
            artistName = artist.stageName();
            venue = recipient.id();
            venueName = recipient.name();
        } else {
            if (artistSlug == null || venueId == null) {
                throw new MessagingErrors.RequestInvalid();
            }
            if (!myVenues(userId).contains(venueId)) {
                throw new MessagingErrors.VenueNotFound();
            }
            var sender = venues.findPublished(venueId).orElseThrow(MessagingErrors.NotPublished::new);
            var artist = artistProfiles.findPublishedBySlug(artistSlug)
                    .orElseThrow(MessagingErrors.RecipientNotFound::new);
            artistId = artist.ownerId();
            artistName = artist.stageName();
            venue = venueId;
            venueName = sender.name();
        }
        lock(SENDER_SALT, userId);
        lock(PAIR_SALT ^ venue.getLeastSignificantBits(), artistId);
        var existing = conversations.findByKindAndArtistIdAndVenueId(ConversationKind.DIRECT, artistId, venue);
        var created = existing.isEmpty();
        Conversation conversation;
        if (created) {
            var dayStart = LocalDate.now(clock.withZone(WARSAW)).atStartOfDay(WARSAW).toInstant();
            if (conversations.countByStartedByAndCreatedAtGreaterThanEqual(userId, dayStart) >= MAX_NEW_PER_DAY) {
                throw new MessagingErrors.LimitReached(MAX_NEW_PER_DAY);
            }
            conversation = conversations.save(Conversation.direct(artistId, venue, artistName, venueName, userId));
        } else {
            conversation = existing.get();
        }
        post(conversation, userId, side, body, clientId);
        return new Started(views(userId, List.of(conversation)).getFirst(), created);
    }

    /** Writes in a conversation; a retry with the same {@code clientId} returns the message already stored. */
    @Transactional
    public MessageView send(UUID userId, UUID conversationId, String body, String clientId) {
        var access = access(userId, conversationId);
        lock(SENDER_SALT, userId);
        return view(post(access.conversation(), userId, access.side(), body, clientId), access.side());
    }

    /** Marks the conversation read up to a message (an older one leaves the mark where it is). */
    @Transactional
    public void read(UUID userId, UUID conversationId, UUID messageId) {
        var access = access(userId, conversationId);
        var message = messages.findByIdAndConversationId(messageId, conversationId)
                .orElseThrow(MessagingErrors.MessageNotFound::new);
        var state = state(conversationId, userId);
        var before = state.getReadUpTo();
        state.read(message.getCreatedAt(), now());
        if (!Objects.equals(before, state.getReadUpTo())) {
            push.read(access.conversation(), access.side(), state.getReadUpTo(), messageId);
        }
    }

    /** Blocks the other side of a direct conversation; nobody writes in it until the caller's side unblocks. */
    @Transactional
    public ConversationView block(UUID userId, UUID conversationId) {
        var access = access(userId, conversationId);
        access.conversation().block(access.side(), now());
        return views(userId, List.of(access.conversation())).getFirst();
    }

    /** Lifts the caller's side's block; the other side's block stays. */
    @Transactional
    public ConversationView unblock(UUID userId, UUID conversationId) {
        var access = access(userId, conversationId);
        access.conversation().unblock(access.side());
        return views(userId, List.of(access.conversation())).getFirst();
    }

    /** Opens a booking's thread for its artist and venue team; nothing happens if it is open already. */
    @Transactional
    public void openBookingThread(UUID bookingId) {
        if (conversations.findByBookingId(bookingId).isPresent()) {
            return;
        }
        bookings.find(bookingId).ifPresent(booking -> conversations.save(Conversation.booking(booking.id(),
                booking.artistId(), booking.venueId(), booking.artistStageName(), booking.venueName())));
    }

    // ---- reading

    @Transactional(readOnly = true)
    public ConversationView get(UUID userId, UUID conversationId) {
        return views(userId, List.of(access(userId, conversationId).conversation())).getFirst();
    }

    /** The caller's conversations with messages, latest first; {@code venueId} narrows to one of their venues. */
    @Transactional(readOnly = true)
    public Page<ConversationView> list(UUID userId, UUID venueId, Pageable pageable) {
        var mine = myVenues(userId);
        if (venueId != null && !mine.contains(venueId)) {
            throw new MessagingErrors.VenueNotFound();
        }
        var scope = venueId != null ? Set.of(venueId) : mine;
        var page = conversations.findActiveOf(venueId != null ? NONE.getFirst() : userId,
                scope.isEmpty() ? NONE : scope, pageable);
        var views = views(userId, page.getContent());
        return page.map(conversation -> views.get(page.getContent().indexOf(conversation)));
    }

    /** Messages newest first, {@code size} (at most 50) at a time, older than {@code before} when given. */
    @Transactional(readOnly = true)
    public MessagePage messages(UUID userId, UUID conversationId, UUID before, int size) {
        var access = access(userId, conversationId);
        var limit = Limit.of(Math.clamp(size, 1, MAX_PAGE) + 1);
        List<ConversationMessage> found;
        if (before == null) {
            found = messages.findNewest(conversationId, limit);
        } else {
            var cursor = messages.findByIdAndConversationId(before, conversationId)
                    .orElseThrow(MessagingErrors.MessageNotFound::new);
            found = messages.findOlder(conversationId, cursor.getCreatedAt(), cursor.getId(), limit);
        }
        var hasMore = found.size() == limit.max();
        var page = hasMore ? found.subList(0, found.size() - 1) : found;
        var conversation = access.conversation();
        var readUpTo = otherReadUpTo(List.of(conversation), Map.of(conversation.getId(), access.side()),
                reads.findByConversationIdIn(List.of(conversationId))).get(conversationId);
        return new MessagePage(page.stream().map(message -> view(message, access.side())).toList(), hasMore,
                readUpTo);
    }

    @Transactional(readOnly = true)
    public UnreadCount unread(UUID userId) {
        var mine = myVenues(userId);
        var rows = messages.countUnread(userId, mine.isEmpty() ? NONE : mine);
        return new UnreadCount(rows.size(), rows.stream().mapToLong(MessageRepository.UnreadRow::getUnread).sum());
    }

    // ---- for the booking module

    @Transactional(readOnly = true)
    public Map<UUID, UUID> bookingThreads(Collection<UUID> bookingIds) {
        return conversations.findByBookingIdIn(bookingIds).stream()
                .collect(Collectors.toMap(Conversation::getBookingId, Conversation::getId));
    }

    // ---- internals

    /** The conversation and the caller's side in it; 404 for anybody outside it. */
    record Access(Conversation conversation, ConversationSide side) {
    }

    Access access(UUID userId, UUID conversationId) {
        var conversation = conversations.findById(conversationId)
                .orElseThrow(MessagingErrors.ConversationNotFound::new);
        if (conversation.getArtistId().equals(userId)) {
            return new Access(conversation, ConversationSide.ARTIST);
        }
        if (myVenues(userId).contains(conversation.getVenueId())) {
            return new Access(conversation, ConversationSide.VENUE);
        }
        throw new MessagingErrors.ConversationNotFound();
    }

    private ConversationMessage post(Conversation conversation, UUID userId, ConversationSide side, String body,
            String clientId) {
        if (clientId != null) {
            var stored = messages.findByConversationIdAndSenderIdAndClientId(conversation.getId(), userId, clientId);
            if (stored.isPresent()) {
                return stored.get();
            }
        }
        if (!conversation.isWritable()) {
            throw new MessagingErrors.Blocked();
        }
        var now = now();
        if (messages.countBySenderIdAndCreatedAtAfter(userId, now.minus(Duration.ofMinutes(1))) >= MAX_PER_MINUTE) {
            throw new MessagingErrors.TooFast(MAX_PER_MINUTE);
        }
        var message = messages.save(new ConversationMessage(conversation.getId(), userId, side, body.strip(),
                clientId));
        conversation.messagePosted(message.getCreatedAt());
        // Writing means the writer has seen the conversation.
        state(conversation.getId(), userId).read(message.getCreatedAt(), now);
        push.message(conversation, message);
        return message;
    }

    /** The person's read state in the conversation, stored empty first if they have none. */
    public ReadState state(UUID conversationId, UUID userId) {
        return reads.findByConversationIdAndUserId(conversationId, userId).orElseGet(() -> {
            reads.insertEmpty(UuidV7.generate(), conversationId, userId);
            return reads.findByConversationIdAndUserId(conversationId, userId).orElseThrow();
        });
    }

    static MessageView view(ConversationMessage message, ConversationSide viewer) {
        var mine = message.getSenderSide() == viewer;
        return new MessageView(message.getId(), message.getConversationId(), message.getSenderSide(), mine,
                message.getBody(), message.getCreatedAt(), mine ? message.getClientId() : null, message.isDeleted());
    }

    /** Views of the conversations for the user, in the same order, with names, photos and counts looked up once. */
    private List<ConversationView> views(UUID userId, List<Conversation> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        var sides = new HashMap<UUID, ConversationSide>();
        list.forEach(conversation -> sides.put(conversation.getId(),
                conversation.getArtistId().equals(userId) ? ConversationSide.ARTIST : ConversationSide.VENUE));
        var ids = list.stream().map(Conversation::getId).toList();

        var artistIds = list.stream().filter(c -> sides.get(c.getId()) == ConversationSide.VENUE)
                .map(Conversation::getArtistId).collect(Collectors.toSet());
        var venueIds = list.stream().filter(c -> sides.get(c.getId()) == ConversationSide.ARTIST)
                .map(Conversation::getVenueId).collect(Collectors.toSet());
        Map<UUID, ArtistCard> artists = artistIds.isEmpty() ? Map.of()
                : artistProfiles.findPublishedCards(artistIds).stream()
                        .collect(Collectors.toMap(ArtistCard::ownerId, card -> card));
        Map<UUID, VenueCard> venueCards = venueIds.isEmpty() ? Map.of()
                : venues.findPublishedCards(venueIds).stream().collect(Collectors.toMap(VenueCard::id, card -> card));
        var photoIds = new HashSet<UUID>();
        artists.values().stream().map(ArtistCard::avatarMediaId).filter(Objects::nonNull).forEach(photoIds::add);
        venueCards.values().stream().map(VenueCard::avatarMediaId).filter(Objects::nonNull).forEach(photoIds::add);
        Map<UUID, MediaImage> photos = photoIds.isEmpty() ? Map.of()
                : media.findAll(photoIds).stream().collect(Collectors.toMap(MediaImage::id, image -> image));

        var latest = messages.findLatestOf(ids).stream()
                .collect(Collectors.toMap(ConversationMessage::getConversationId, message -> message));
        var mine = myVenues(userId);
        var unread = messages.countUnread(userId, mine.isEmpty() ? NONE : mine).stream()
                .collect(Collectors.toMap(MessageRepository.UnreadRow::getConversationId,
                        MessageRepository.UnreadRow::getUnread));
        var readUpTo = otherReadUpTo(list, sides, reads.findByConversationIdIn(ids));

        var result = new ArrayList<ConversationView>(list.size());
        for (var conversation : list) {
            var side = sides.get(conversation.getId());
            ConversationView.Party other;
            if (side == ConversationSide.ARTIST) {
                var card = venueCards.get(conversation.getVenueId());
                other = card == null ? new ConversationView.Party(conversation.getVenueName(), null, null)
                        : new ConversationView.Party(card.name(), card.slug(), photo(photos, card.avatarMediaId()));
            } else {
                var card = artists.get(conversation.getArtistId());
                other = card == null ? new ConversationView.Party(conversation.getArtistName(), null, null)
                        : new ConversationView.Party(card.stageName(), card.slug(),
                                photo(photos, card.avatarMediaId()));
            }
            var last = latest.get(conversation.getId());
            // Booking threads show the gig's date; a page holds few of them, so one lookup each is fine.
            var startsAt = conversation.getBookingId() == null ? null
                    : bookings.find(conversation.getBookingId()).map(BookingInfo::startsAt).orElse(null);
            result.add(new ConversationView(conversation, side, other, last == null ? null : view(last, side),
                    unread.getOrDefault(conversation.getId(), 0L), readUpTo.get(conversation.getId()), startsAt));
        }
        return result;
    }

    /** Up to when the other side has read each conversation: the artist, or anybody in the venue's current team. */
    private Map<UUID, Instant> otherReadUpTo(List<Conversation> list, Map<UUID, ConversationSide> sides,
            List<ReadState> states) {
        var venueIds = list.stream().filter(c -> sides.get(c.getId()) == ConversationSide.ARTIST)
                .map(Conversation::getVenueId).collect(Collectors.toSet());
        var teams = venues.teamsOf(venueIds);
        var byConversation = states.stream().collect(Collectors.groupingBy(ReadState::getConversationId));
        var result = new HashMap<UUID, Instant>();
        for (var conversation : list) {
            Set<UUID> others = sides.get(conversation.getId()) == ConversationSide.ARTIST
                    ? teams.getOrDefault(conversation.getVenueId(), Set.of())
                    : Set.of(conversation.getArtistId());
            byConversation.getOrDefault(conversation.getId(), List.of()).stream()
                    .filter(state -> others.contains(state.getUserId()) && state.getReadUpTo() != null)
                    .map(ReadState::getReadUpTo)
                    .max(Instant::compareTo)
                    .ifPresent(time -> result.put(conversation.getId(), time));
        }
        return result;
    }

    private static String photo(Map<UUID, MediaImage> photos, UUID id) {
        var image = id == null ? null : photos.get(id);
        return image == null ? null : image.small();
    }

    private Set<UUID> myVenues(UUID userId) {
        return venues.findManagedBy(userId).stream().map(member -> member.venueId()).collect(Collectors.toSet());
    }

    private void lock(long salt, UUID id) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                id.getMostSignificantBits() ^ id.getLeastSignificantBits() ^ salt);
    }

    private Instant now() {
        return clock.instant();
    }
}
