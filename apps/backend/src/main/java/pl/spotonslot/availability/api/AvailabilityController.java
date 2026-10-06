package pl.spotonslot.availability.api;

import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
import pl.spotonslot.availability.api.AvailabilityDtos.OccurrenceResponse;
import pl.spotonslot.availability.api.AvailabilityDtos.RuleRequest;
import pl.spotonslot.availability.api.AvailabilityDtos.RuleResponse;
import pl.spotonslot.availability.api.AvailabilityDtos.SlotRequest;
import pl.spotonslot.availability.api.AvailabilityDtos.SlotResponse;
import pl.spotonslot.availability.application.AvailabilityService;

/** The signed-in artist's own calendar: free slots, weekly rules and skipped dates. */
@RestController
@RequestMapping("/api/v1/availability/me")
@PreAuthorize("hasRole('ARTIST')")
@RequiredArgsConstructor
class AvailabilityController {

    private final AvailabilityService availability;

    /** Slots and rule dates overlapping {@code [from, to)} (at most 92 days), in order. */
    @GetMapping
    List<OccurrenceResponse> calendar(@AuthenticationPrincipal Jwt jwt, @RequestParam Instant from,
            @RequestParam Instant to) {
        return availability.calendar(owner(jwt), from, to).stream().map(OccurrenceResponse::of).toList();
    }

    @PostMapping("/slots")
    @ResponseStatus(HttpStatus.CREATED)
    SlotResponse addSlot(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SlotRequest request) {
        return SlotResponse.of(availability.addSlot(owner(jwt), request.startsAt(), request.endsAt(), request.note()));
    }

    @PutMapping("/slots/{id}")
    SlotResponse updateSlot(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody SlotRequest request) {
        return SlotResponse.of(
                availability.updateSlot(owner(jwt), id, request.startsAt(), request.endsAt(), request.note()));
    }

    @DeleteMapping("/slots/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteSlot(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        availability.deleteSlot(owner(jwt), id);
    }

    @GetMapping("/rules")
    List<RuleResponse> rules(@AuthenticationPrincipal Jwt jwt) {
        return availability.listRules(owner(jwt)).stream().map(RuleResponse::of).toList();
    }

    @PostMapping("/rules")
    @ResponseStatus(HttpStatus.CREATED)
    RuleResponse addRule(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RuleRequest request) {
        return RuleResponse.of(availability.addRule(owner(jwt), request.toDetails()));
    }

    @PutMapping("/rules/{id}")
    RuleResponse updateRule(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody RuleRequest request) {
        return RuleResponse.of(availability.updateRule(owner(jwt), id, request.toDetails()));
    }

    @DeleteMapping("/rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRule(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        availability.deleteRule(owner(jwt), id);
    }

    /** Leaves one date of the rule out. */
    @DeleteMapping("/rules/{id}/dates/{date}")
    RuleResponse skipDate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable LocalDate date) {
        return RuleResponse.of(availability.skipDate(owner(jwt), id, date));
    }

    /** Brings a skipped date back. */
    @PutMapping("/rules/{id}/dates/{date}")
    RuleResponse restoreDate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable LocalDate date) {
        return RuleResponse.of(availability.restoreDate(owner(jwt), id, date));
    }

    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
