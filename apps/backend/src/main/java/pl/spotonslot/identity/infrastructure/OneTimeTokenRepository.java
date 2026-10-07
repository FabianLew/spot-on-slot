package pl.spotonslot.identity.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.identity.domain.TokenType;

public interface OneTimeTokenRepository extends JpaRepository<OneTimeToken, UUID> {

    Optional<OneTimeToken> findByTokenHashAndType(String tokenHash, TokenType type);

    List<OneTimeToken> findByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, TokenType type);

    /** Spends every unused token of the type, e.g. pending address changes once the password changes. */
    @Modifying
    @Query("update OneTimeToken t set t.usedAt = :now, t.updatedAt = :now, t.version = t.version + 1"
            + " where t.userId = :userId and t.type = :type and t.usedAt is null")
    int useAllOf(UUID userId, TokenType type, Instant now);
}
