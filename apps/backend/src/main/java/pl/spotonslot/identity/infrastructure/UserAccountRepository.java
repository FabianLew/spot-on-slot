package pl.spotonslot.identity.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.identity.Role;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID>, JpaSpecificationExecutor<UserAccount> {

    Optional<UserAccount> findByEmail(String email);

    @Query("select a.status from UserAccount a where a.id = :id")
    Optional<AccountStatus> findStatusById(UUID id);

    /** Those of the accounts that are waiting for deletion or blocked. */
    @Query("select a.id from UserAccount a where a.id in :ids and a.status in ("
            + "pl.spotonslot.identity.domain.AccountStatus.DELETION_PENDING,"
            + " pl.spotonslot.identity.domain.AccountStatus.BLOCKED)")
    Set<UUID> findSilencedAmong(Collection<UUID> ids);

    List<UserAccount> findByRoleOrderByCreatedAt(Role role);

    long countByRoleAndStatus(Role role, AccountStatus status);

    /** Accounts whose deletion was requested before {@code before}, oldest first. */
    @Query("select a from UserAccount a where a.status = pl.spotonslot.identity.domain.AccountStatus.DELETION_PENDING"
            + " and a.deletionRequestedAt <= :before order by a.deletionRequestedAt")
    List<UserAccount> findDeletionDue(Instant before);

    @Modifying
    @Query("delete from UserAccount a where a.status = :status and a.createdAt < :before")
    int deleteByStatusAndCreatedAtBefore(AccountStatus status, Instant before);
}
