package pl.spotonslot.booking.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.booking.BookingStatus;
import pl.spotonslot.booking.application.BookingView;
import pl.spotonslot.booking.domain.BookingStepType;
import pl.spotonslot.booking.domain.BookingTerms;

/** Request and response shapes of the booking API. */
final class BookingDtos {

    /** 100 000 PLN in grosze, as for rates and listings. */
    static final long MAX_AMOUNT = 10_000_000L;

    private BookingDtos() {
    }

    static String text(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    /**
     * Starts a booking. A venue account sends {@code venueId} and either {@code artistSlug} or {@code listingId}
     * of an artist's "I'm free" listing (whose time applies when {@code startsAt}/{@code endsAt} are left out). An
     * artist sends {@code listingId} of a venue's "looking for an artist" listing; its time applies.
     */
    record CreateBookingRequest(
            UUID venueId,
            String artistSlug,
            UUID listingId,
            Instant startsAt,
            Instant endsAt,
            @NotNull @PositiveOrZero @Max(MAX_AMOUNT) @Schema(requiredMode = REQUIRED, description = "Grosze")
            Long amount,
            @Size(max = 1000) String message) {
    }

    /** New terms from the side whose turn it is. */
    record CounterRequest(
            @NotNull @Schema(requiredMode = REQUIRED) Instant startsAt,
            @NotNull @Schema(requiredMode = REQUIRED) Instant endsAt,
            @NotNull @PositiveOrZero @Max(MAX_AMOUNT) @Schema(requiredMode = REQUIRED, description = "Grosze")
            Long amount,
            @Size(max = 1000) String message) {

        BookingTerms toTerms() {
            return new BookingTerms(startsAt, endsAt, amount, text(message));
        }
    }

    /** Accepts the proposal with this {@code revision}; a newer one in between fails with 409. */
    record AcceptRequest(@NotNull @Positive @Schema(requiredMode = REQUIRED) Integer revision) {
    }

    record DeclineRequest(@Size(max = 500) String reason) {
    }

    record CancelRequest(@NotBlank @Size(max = 500) @Schema(requiredMode = REQUIRED) String reason) {
    }

    /** {@code slug} is null while the profile is unpublished; the name is the one from when the booking started. */
    @Schema(name = "BookingArtist")
    record ArtistRef(String slug, @Schema(requiredMode = REQUIRED) String stageName) {
    }

    @Schema(name = "BookingVenue")
    record VenueRef(@Schema(requiredMode = REQUIRED) UUID id, String slug, @Schema(requiredMode = REQUIRED) String name) {
    }

    @Schema(name = "BookingStep")
    record StepResponse(
            @Schema(requiredMode = REQUIRED) BookingStepType type,
            @Schema(requiredMode = REQUIRED) BookingParty party,
            @Schema(requiredMode = REQUIRED, description = "Taken by the viewer's side") boolean mine,
            @Schema(requiredMode = REQUIRED) Instant at,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED, description = "Grosze") long amount,
            String message,
            @Schema(requiredMode = REQUIRED, description = "The author's account was deleted and the message with "
                    + "it; show \"message deleted\"") boolean messageDeleted) {
    }

    /**
     * A booking for one of its sides. {@code awaiting} is the side whose answer it waits for (null once it is not
     * pending); {@code myTurn} says the viewer's side may accept, decline or counter, {@code canWithdraw} that it
     * made the latest proposal and may take it back. {@code message} is the latest proposal's.
     */
    record BookingResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) BookingStatus status,
            BookingParty awaiting,
            @Schema(requiredMode = REQUIRED) BookingParty myParty,
            @Schema(requiredMode = REQUIRED) boolean myTurn,
            @Schema(requiredMode = REQUIRED) boolean canWithdraw,
            @Schema(requiredMode = REQUIRED) BookingParty initiator,
            UUID listingId,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED, description = "Grosze") long amount,
            @Schema(requiredMode = REQUIRED) int revision,
            @Schema(description = "While pending: when it expires unanswered (72 h after the latest proposal, or its "
                    + "start if sooner)") Instant respondBy,
            String message,
            @Schema(requiredMode = REQUIRED) ArtistRef artist,
            @Schema(requiredMode = REQUIRED) VenueRef venue,
            @Schema(description = "The booking's conversation thread, opened right after the request")
            UUID conversationId,
            @Schema(requiredMode = REQUIRED) List<StepResponse> steps,
            @Schema(requiredMode = REQUIRED) Instant createdAt) {

        static BookingResponse of(BookingView view) {
            var booking = view.booking();
            var pending = view.status() == BookingStatus.PENDING;
            return new BookingResponse(booking.getId(), view.status(), view.awaiting(), view.viewer(),
                    pending && view.awaiting() == view.viewer(), pending && view.proposer() == view.viewer(),
                    booking.getInitiator(), booking.getListingId(), booking.getStartsAt(), booking.getEndsAt(),
                    booking.getAmount(), booking.getRevision(), pending ? booking.timedOutAt() : null,
                    view.message(), new ArtistRef(view.artistSlug(), booking.getArtistStageName()),
                    new VenueRef(booking.getVenueId(), view.venueSlug(), booking.getVenueName()),
                    view.conversationId(), view.steps().stream().map(step -> new StepResponse(step.type(), step.party(), step.mine(),
                            step.at(), step.startsAt(), step.endsAt(), step.amount(), step.message(),
                            step.messageDeleted())).toList(),
                    booking.getCreatedAt());
        }
    }
}
