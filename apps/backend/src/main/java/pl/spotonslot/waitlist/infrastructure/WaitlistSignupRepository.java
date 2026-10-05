package pl.spotonslot.waitlist.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import pl.spotonslot.waitlist.domain.WaitlistSignup;
import pl.spotonslot.waitlist.domain.WaitlistStatus;

public interface WaitlistSignupRepository extends JpaRepository<WaitlistSignup, UUID> {

    Optional<WaitlistSignup> findByEmail(String email);

    Optional<WaitlistSignup> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from WaitlistSignup s where s.status = :status and s.createdAt < :before")
    int deleteByStatusAndCreatedAtBefore(WaitlistStatus status, Instant before);
}
