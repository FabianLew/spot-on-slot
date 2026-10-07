package pl.spotonslot.identity.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByEmail(String email);

    boolean existsByIdAndStatus(UUID id, AccountStatus status);

    @Query("select a.id from UserAccount a where a.id in :ids"
            + " and a.status = pl.spotonslot.identity.domain.AccountStatus.DELETION_PENDING")
    Set<UUID> findDeletionPendingAmong(Collection<UUID> ids);

    /** Accounts whose deletion was requested before {@code before}, oldest first. */
    @Query("select a from UserAccount a where a.status = pl.spotonslot.identity.domain.AccountStatus.DELETION_PENDING"
            + " and a.deletionRequestedAt <= :before order by a.deletionRequestedAt")
    List<UserAccount> findDeletionDue(Instant before);

    @Modifying
    @Query("delete from UserAccount a where a.status = :status and a.createdAt < :before")
    int deleteByStatusAndCreatedAtBefore(AccountStatus status, Instant before);
}
