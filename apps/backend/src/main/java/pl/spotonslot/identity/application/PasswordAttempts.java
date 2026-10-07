package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.UserAccount;

/**
 * Checks the current password that account changes (e-mail, password, deletion) ask for: at most
 * {@value #MAX_FAILURES} wrong ones per account within {@link #WINDOW}, then 429 until the oldest leaves the window.
 * Kept in memory, which is enough for the one backend instance of the MVP; B16 (rate limits) can move it to shared
 * storage.
 */
@Component
@RequiredArgsConstructor
class PasswordAttempts {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final Map<UUID, Deque<Instant>> failures = new ConcurrentHashMap<>();

    /**
     * Throws {@link IdentityErrors.TooManyAttempts} when the account is locked out, {@link IdentityErrors.WrongPassword}
     * (reported at {@code field}) when the password does not match.
     */
    void verify(UserAccount account, String password, String field) {
        var now = clock.instant();
        var recent = failures.computeIfAbsent(account.getId(), id -> new ArrayDeque<>());
        synchronized (recent) {
            while (!recent.isEmpty() && !recent.peekFirst().isAfter(now.minus(WINDOW))) {
                recent.pollFirst();
            }
            if (recent.size() >= MAX_FAILURES) {
                throw new IdentityErrors.TooManyAttempts();
            }
        }
        if (password == null || !passwordEncoder.matches(password, account.getPasswordHash())) {
            synchronized (recent) {
                recent.addLast(now);
            }
            throw new IdentityErrors.WrongPassword(field);
        }
        failures.remove(account.getId());
    }
}
