package pl.spotonslot.identity.application;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

@Service
@RequiredArgsConstructor
public class AccountQueries {

    private final UserAccountRepository accounts;

    /** The account behind a valid access token; one deleted in the meantime counts as signed out. */
    @Transactional(readOnly = true)
    public UserAccount get(UUID id) {
        return accounts.findById(id).orElseThrow(IdentityErrors.RefreshInvalid::new);
    }
}
