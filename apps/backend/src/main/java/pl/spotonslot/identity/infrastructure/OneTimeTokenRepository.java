package pl.spotonslot.identity.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.identity.domain.TokenType;

public interface OneTimeTokenRepository extends JpaRepository<OneTimeToken, UUID> {

    Optional<OneTimeToken> findByTokenHashAndType(String tokenHash, TokenType type);

    List<OneTimeToken> findByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, TokenType type);
}
