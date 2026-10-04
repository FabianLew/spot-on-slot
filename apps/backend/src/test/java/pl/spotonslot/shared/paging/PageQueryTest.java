package pl.spotonslot.shared.paging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import pl.spotonslot.shared.error.InvalidRequestException;

class PageQueryTest {

    private static final Set<String> ALLOWED = Set.of("title", "createdAt");
    private static final Sort DEFAULT = Sort.by(Sort.Direction.DESC, "createdAt");

    @Test
    void usesDefaultsWhenNothingGiven() {
        assertThat(new PageQuery(null, null, null).toPageable(ALLOWED, DEFAULT))
                .isEqualTo(PageRequest.of(0, 20, DEFAULT));
    }

    @Test
    void blankSortFallsBackToDefault() {
        assertThat(new PageQuery(null, null, "  ").toPageable(ALLOWED, DEFAULT).getSort()).isEqualTo(DEFAULT);
    }

    @Test
    void usesGivenPageAndSize() {
        assertThat(new PageQuery(2, 50, null).toPageable(ALLOWED, DEFAULT))
                .isEqualTo(PageRequest.of(2, 50, DEFAULT));
    }

    @Test
    void fieldWithoutDirectionIsAscending() {
        assertThat(new PageQuery(null, null, "title").toPageable(ALLOWED, DEFAULT).getSort())
                .isEqualTo(Sort.by(Sort.Direction.ASC, "title"));
    }

    @Test
    void parsesDirectionCaseInsensitively() {
        assertThat(new PageQuery(null, null, "title,desc").toPageable(ALLOWED, DEFAULT).getSort())
                .isEqualTo(Sort.by(Sort.Direction.DESC, "title"));
        assertThat(new PageQuery(null, null, "title,ASC").toPageable(ALLOWED, DEFAULT).getSort())
                .isEqualTo(Sort.by(Sort.Direction.ASC, "title"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"password,asc", ",desc", "a,b,c", "title,sideways", ",", "title,"})
    void rejectsInvalidSort(String sort) {
        PageQuery query = new PageQuery(null, null, sort);
        assertThatThrownBy(() -> query.toPageable(ALLOWED, DEFAULT))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("code").isEqualTo("INVALID_SORT");
    }
}
