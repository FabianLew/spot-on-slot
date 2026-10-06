package pl.spotonslot.artist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class SlugsTest {

    @ParameterizedTest
    @CsvSource({
            "Weronika K., weronika-k",
            "Łukasz Żółć, lukasz-zolc",
            "  DJ   Szał!!  , dj-szal",
            "Ćma & Ślimak, cma-slimak",
            "MC_Ögur 2000, mc-ogur-2000",
    })
    void turnsAStageNameIntoASlug(String stageName, String slug) {
        assertThat(Slugs.fromStageName(stageName)).isEqualTo(slug);
    }

    @Test
    void cutsLongNamesAtFortyCharactersWithoutATrailingDash() {
        var slug = Slugs.fromStageName("The Very Long Stage Name Of An Artist Who Plays Everything");
        assertThat(slug).hasSizeLessThanOrEqualTo(40).doesNotEndWith("-").startsWith("the-very-long-stage-name");
    }

    @Test
    void namesWithoutLettersOrDigitsFallBackToArtist() {
        assertThat(Slugs.fromStageName("!!!")).isEqualTo("artist");
    }

    @Test
    void numbersCandidatesForCollisions() {
        assertThat(Slugs.candidate("weronika", 1)).isEqualTo("weronika");
        assertThat(Slugs.candidate("weronika", 2)).isEqualTo("weronika-2");
        assertThat(Slugs.candidate("dj", 1)).isEqualTo("dj-1");
        assertThat(Slugs.candidate("a".repeat(40), 12)).hasSize(40).endsWith("-12");
        assertThat(Slugs.candidate("admin", 1)).isEqualTo("admin-1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "weronika-k", "dj-2000", "a1b"})
    void acceptsValidSlugs(String slug) {
        assertThat(Slugs.isValid(slug)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ab", "Weronika", "-dj", "dj-", "dj--k", "dj k", "żółw"})
    void rejectsInvalidSlugs(String slug) {
        assertThat(Slugs.isValid(slug)).isFalse();
    }

    @Test
    void knowsReservedWords() {
        assertThat(Slugs.isReserved("admin")).isTrue();
        assertThat(Slugs.isReserved("me")).isTrue();
        assertThat(Slugs.isReserved("weronika")).isFalse();
    }
}
