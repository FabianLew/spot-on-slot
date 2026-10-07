package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.domain.IdentityErrors;

/** One data export per account per minute; in memory, like {@link PasswordAttempts}. */
@Component
@RequiredArgsConstructor
class ExportLimit {

    static final Duration INTERVAL = Duration.ofMinutes(1);

    private final Clock clock;
    private final Map<UUID, Instant> lastExport = new ConcurrentHashMap<>();

    void acquire(UUID userId) {
        var now = clock.instant();
        var previous = lastExport.get(userId);
        if (previous != null && now.isBefore(previous.plus(INTERVAL))) {
            throw new IdentityErrors.ExportTooSoon();
        }
        lastExport.put(userId, now);
        if (lastExport.size() > 10_000) {
            lastExport.values().removeIf(at -> now.isAfter(at.plus(INTERVAL)));
        }
    }
}
