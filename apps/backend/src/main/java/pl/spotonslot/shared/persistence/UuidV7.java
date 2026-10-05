package pl.spotonslot.shared.persistence;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * Time-ordered UUID (version 7, RFC 9562).
 *
 * <p>Layout: 48-bit Unix millisecond timestamp, version nibble, 12-bit {@code rand_a} used as a
 * counter that increments within the same millisecond, variant bits, 62 random bits. Ids are
 * strictly increasing within one JVM: if the clock stands still or moves backwards the last
 * timestamp is kept and the counter keeps incrementing; on counter overflow the timestamp advances
 * by one millisecond.
 */
public final class UuidV7 {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int COUNTER_MAX = 0xFFF;
    private static final int COUNTER_SEED_BOUND = 0x200;
    private static final long RAND_B_MASK = 0x3FFF_FFFF_FFFF_FFFFL;
    private static final long VARIANT_RFC = 0x8000_0000_0000_0000L;

    private static long lastTimestamp = -1;
    private static int counter;

    private UuidV7() {}

    public static synchronized UUID generate() {
        long now = System.currentTimeMillis();
        if (now > lastTimestamp) {
            lastTimestamp = now;
            // Seed below the maximum so a fresh millisecond has headroom for the counter.
            counter = RANDOM.nextInt(COUNTER_SEED_BOUND);
        } else if (counter < COUNTER_MAX) {
            counter++;
        } else {
            lastTimestamp++;
            counter = RANDOM.nextInt(COUNTER_SEED_BOUND);
        }

        long msb = (lastTimestamp << 16) | (0x7L << 12) | counter;
        long lsb = (RANDOM.nextLong() & RAND_B_MASK) | VARIANT_RFC;
        return new UUID(msb, lsb);
    }
}
