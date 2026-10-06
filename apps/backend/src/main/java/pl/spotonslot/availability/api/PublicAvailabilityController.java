package pl.spotonslot.availability.api;

import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.availability.api.AvailabilityDtos.PublicOccurrenceResponse;
import pl.spotonslot.availability.application.AvailabilityService;

/** When a published artist is free or booked, for anyone with the link (no notes, no ids). */
@RestController
@RequestMapping("/api/v1/public/artists")
@RequiredArgsConstructor
class PublicAvailabilityController {

    private final AvailabilityService availability;

    @GetMapping("/{slug}/availability")
    List<PublicOccurrenceResponse> calendar(@PathVariable String slug, @RequestParam Instant from,
            @RequestParam Instant to) {
        return availability.publicCalendar(slug, from, to).stream().map(PublicOccurrenceResponse::of).toList();
    }
}
