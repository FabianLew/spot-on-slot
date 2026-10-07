package pl.spotonslot.identity.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.identity.domain.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.updatedAt = :now, t.version = t.version + 1 "
            + "where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(UUID familyId, Instant now);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.updatedAt = :now, t.version = t.version + 1 "
            + "where t.userId = :userId and t.revokedAt is null")
    int revokeAllForUser(UUID userId, Instant now);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.updatedAt = :now, t.version = t.version + 1 "
            + "where t.userId = :userId and t.familyId <> :keepFamily and t.revokedAt is null")
    int revokeAllForUserExcept(UUID userId, UUID keepFamily, Instant now);
}
