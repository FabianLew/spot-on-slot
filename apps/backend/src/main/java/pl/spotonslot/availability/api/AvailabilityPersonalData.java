package pl.spotonslot.availability.api;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.availability.api.AvailabilityDtos.RuleResponse;
import pl.spotonslot.availability.api.AvailabilityDtos.SlotResponse;
import pl.spotonslot.availability.infrastructure.AvailabilityRuleRepository;
import pl.spotonslot.availability.infrastructure.AvailabilitySlotRepository;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;

/** The calendar: every slot and weekly rule with its notes. */
@Component
@RequiredArgsConstructor
class AvailabilityPersonalData implements PersonalDataSection {

    record CalendarExport(List<SlotResponse> slots, List<RuleResponse> rules) {
    }

    private final AvailabilitySlotRepository slots;
    private final AvailabilityRuleRepository rules;

    @Override
    public String key() {
        return "calendar";
    }

    @Override
    @Transactional(readOnly = true)
    public Object export(AccountInfo account) {
        return new CalendarExport(slots.findByOwnerIdOrderByStartsAt(account.id()).stream().map(SlotResponse::of)
                .toList(),
                rules.findByOwnerIdInOrderByCreatedAt(List.of(account.id())).stream().map(RuleResponse::of)
                        .toList());
    }
}
