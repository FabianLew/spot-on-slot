package pl.spotonslot.waitlist;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import pl.spotonslot.waitlist.domain.ConfirmationToken;

class ConfirmationTokenTest {

    @Test
    void generatesBase64UrlTokensOf32Bytes() {
        assertThat(ConfirmationToken.generate()).hasSize(43).matches("[A-Za-z0-9_-]{43}");
    }

    @Test
    void generatesUniqueTokens() {
        var tokens = new HashSet<String>();
        IntStream.range(0, 1000).forEach(i -> tokens.add(ConfirmationToken.generate()));

        assertThat(tokens).hasSize(1000);
    }

    @Test
    void hashesToHexSha256() {
        // SHA-256 of "abc" (FIPS 180-2 test vector).
        assertThat(ConfirmationToken.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void hashIsDeterministic() {
        var token = ConfirmationToken.generate();

        assertThat(ConfirmationToken.hash(token)).hasSize(64).matches("[0-9a-f]{64}")
                .isEqualTo(ConfirmationToken.hash(token));
    }
}
