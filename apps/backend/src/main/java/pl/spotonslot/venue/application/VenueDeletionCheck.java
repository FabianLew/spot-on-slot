package pl.spotonslot.venue.application;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeletionCheck;
import pl.spotonslot.identity.DeletionBlocker;

/** An account cannot be deleted while it is the last owner of a venue whose team has other people. */
@Component
@RequiredArgsConstructor
class VenueDeletionCheck implements AccountDeletionCheck {

    private final VenueAccountService accounts;

    @Override
    public List<DeletionBlocker> blockersFor(UUID userId) {
        return accounts.lastOwnerBlockers(userId);
    }
}
