package pl.spotonslot.identity;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/** The module's facade for other modules: e-mail, role and language of accounts by id. */
@Service
@RequiredArgsConstructor
public class Accounts {

    private final UserAccountRepository accounts;

    @Transactional(readOnly = true)
    public Optional<AccountInfo> find(UUID id) {
        return accounts.findById(id).map(Accounts::info);
    }

    /** E-mail addresses of the given accounts; ids without an account are left out. */
    @Transactional(readOnly = true)
    public Map<UUID, String> emails(Collection<UUID> ids) {
        return accounts.findAllById(ids).stream()
                .collect(Collectors.toMap(UserAccount::getId, UserAccount::getEmail));
    }

    private static AccountInfo info(UserAccount account) {
        return new AccountInfo(account.getId(), account.getEmail(), account.getRole(), account.getLocale());
    }
}
