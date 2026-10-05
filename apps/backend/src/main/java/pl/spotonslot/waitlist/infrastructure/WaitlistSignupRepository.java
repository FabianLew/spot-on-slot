package pl.spotonslot.waitlist.infrastructure;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import pl.spotonslot.waitlist.domain.WaitlistSignup;

public interface WaitlistSignupRepository extends JpaRepository<WaitlistSignup, UUID> {

    Optional<WaitlistSignup> findByEmail(String email);
}
