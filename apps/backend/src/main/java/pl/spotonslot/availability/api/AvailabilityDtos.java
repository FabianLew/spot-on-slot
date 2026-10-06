package pl.spotonslot.availability.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.availability.domain.AvailabilityRule;
import pl.spotonslot.availability.domain.AvailabilitySlot;
import pl.spotonslot.availability.domain.Occurrence;
import pl.spotonslot.availability.domain.RuleDetails;
import pl.spotonslot.availability.domain.SlotStatus;

/** Request and response shapes of the availability API. */
final class AvailabilityDtos {

    private AvailabilityDtos() {
    }

    /** One free stretch of time; it may cross midnight. */
    record SlotRequest(
            @NotNull @Schema(requiredMode = REQUIRED) Instant startsAt,
            @NotNull @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Size(max = 200) String note) {
    }

    /** Free every chosen weekday at {@code startTime} (artist's time zone) for {@code durationMinutes}. */
    record RuleRequest(
            @NotEmpty @Schema(requiredMode = REQUIRED) Set<@NotNull DayOfWeek> days,
            @NotNull @Schema(requiredMode = REQUIRED, type = "string", example = "21:00") LocalTime startTime,
            @Schema(requiredMode = REQUIRED, example = "360") int durationMinutes,
            @NotNull @Schema(requiredMode = REQUIRED) LocalDate validFrom,
            LocalDate validUntil,
            @Size(max = 200) String note) {

        RuleDetails toDetails() {
            return new RuleDetails(days, startTime, durationMinutes, validFrom, validUntil, note);
        }
    }

    record SlotResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) SlotStatus status,
            String note) {

        static SlotResponse of(AvailabilitySlot slot) {
            return new SlotResponse(slot.getId(), slot.getStartsAt(), slot.getEndsAt(), slot.getStatus(),
                    slot.getNote());
        }
    }

    record RuleResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) List<DayOfWeek> days,
            @Schema(requiredMode = REQUIRED, type = "string", example = "21:00") LocalTime startTime,
            @Schema(requiredMode = REQUIRED) int durationMinutes,
            @Schema(requiredMode = REQUIRED) LocalDate validFrom,
            LocalDate validUntil,
            @Schema(requiredMode = REQUIRED, example = "Europe/Warsaw") String timeZone,
            String note,
            @Schema(requiredMode = REQUIRED) List<LocalDate> skippedDates) {

        static RuleResponse of(AvailabilityRule rule) {
            return new RuleResponse(rule.getId(), rule.getDays(), rule.getStartTime(), rule.getDurationMinutes(),
                    rule.getValidFrom(), rule.getValidUntil(), rule.getTimeZone(), rule.getNote(),
                    rule.getSkippedDates());
        }
    }

    /** A slot ({@code slotId}) or one date of a rule ({@code ruleId} + {@code date}) in the artist's own calendar. */
    record OccurrenceResponse(
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) SlotStatus status,
            String note,
            @Schema(requiredMode = REQUIRED) Occurrence.Source source,
            UUID slotId,
            UUID ruleId,
            LocalDate date) {

        static OccurrenceResponse of(Occurrence occurrence) {
            return new OccurrenceResponse(occurrence.startsAt(), occurrence.endsAt(), occurrence.status(),
                    occurrence.note(), occurrence.source(), occurrence.slotId(), occurrence.ruleId(),
                    occurrence.date());
        }
    }

    /** What anyone sees: only when the artist is free or booked. */
    record PublicOccurrenceResponse(
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) SlotStatus status) {

        static PublicOccurrenceResponse of(Occurrence occurrence) {
            return new PublicOccurrenceResponse(occurrence.startsAt(), occurrence.endsAt(), occurrence.status());
        }
    }
}
