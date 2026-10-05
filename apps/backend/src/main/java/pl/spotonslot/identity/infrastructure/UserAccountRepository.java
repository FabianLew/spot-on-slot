package pl.spotonslot.identity.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByEmail(String email);

    @Modifying
    @Query("delete from UserAccount a where a.status = :status and a.createdAt < :before")
    int deleteByStatusAndCreatedAtBefore(AccountStatus status, Instant before);
}
