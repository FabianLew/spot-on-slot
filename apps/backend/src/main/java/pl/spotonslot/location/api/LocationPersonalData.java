package pl.spotonslot.location.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.location.infrastructure.LocationRepository;

/** The person's location: the town and the rounded (~1 km) point; null when none is set. */
@Component
@RequiredArgsConstructor
class LocationPersonalData implements PersonalDataSection {

    private final LocationRepository locations;

    @Override
    public String key() {
        return "location";
    }

    @Override
    @Transactional(readOnly = true)
    public Object export(AccountInfo account) {
        return locations.findBySubjectTypeAndSubjectId(SubjectType.USER, account.id())
                .map(LocationController::toResponse).orElse(null);
    }
}
