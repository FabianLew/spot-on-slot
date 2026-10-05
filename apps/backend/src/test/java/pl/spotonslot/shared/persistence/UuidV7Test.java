package pl.spotonslot.shared.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UuidV7Test {

    @Test
    void hasVersion7AndRfcVariant() {
        UUID uuid = UuidV7.generate();

        assertThat(uuid.version()).isEqualTo(7);
        assertThat(uuid.variant()).isEqualTo(2);
    }

    @Test
    void embedsCurrentTimestamp() {
        long before = System.currentTimeMillis();
        UUID uuid = UuidV7.generate();
        long after = System.currentTimeMillis();

        long timestamp = uuid.getMostSignificantBits() >>> 16;

        assertThat(timestamp).isBetween(before, after);
    }

    @Test
    void isUniqueAndMonotonic() {
        Set<UUID> seen = new HashSet<>();
        String previous = UuidV7.generate().toString();

        for (int i = 0; i < 10_000; i++) {
            UUID next = UuidV7.generate();
            String current = next.toString();

            assertThat(current.compareTo(previous)).isPositive();
            assertThat(seen.add(next)).isTrue();
            previous = current;
        }
    }
}
