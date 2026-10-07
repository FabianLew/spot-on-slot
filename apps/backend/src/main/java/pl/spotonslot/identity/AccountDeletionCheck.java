package pl.spotonslot.identity;

import java.util.List;
import java.util.UUID;

/**
 * Implemented by modules that can stop an account's deletion (venue: the last owner of a shared team). Identity asks
 * every implementation before accepting a deletion request; the dependency points from the module to identity.
 */
public interface AccountDeletionCheck {

    List<DeletionBlocker> blockersFor(UUID userId);
}
