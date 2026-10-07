package pl.spotonslot.availability.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.availability.infrastructure.AvailabilityRuleRepository;
import pl.spotonslot.availability.infrastructure.AvailabilitySlotRepository;
import pl.spotonslot.identity.AccountDeleted;

/** A purged account's calendar (slots, rules with their days and skipped dates) is deleted. */
@Component
@RequiredArgsConstructor
class AvailabilityAccountListener {

    private final AvailabilitySlotRepository slots;
    private final AvailabilityRuleRepository rules;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        slots.deleteAllOf(event.userId());
        rules.deleteAllOf(event.userId());
    }
}
