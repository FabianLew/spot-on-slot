package pl.spotonslot.shared.paging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.shared.persistence.TestNote;
import pl.spotonslot.shared.persistence.TestNoteRepository;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@WithMockUser
class PagingIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    TestNoteRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        repository.save(new TestNote("b"));
        repository.save(new TestNote("a"));
        repository.save(new TestNote("c"));
    }

    @AfterEach
    void tearDown() {
        repository.deleteAll();
    }

    @Test
    void returnsPageEnvelope() throws Exception {
        mvc.perform(get("/test/paging").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void sortsByRequestedField() throws Exception {
        mvc.perform(get("/test/paging").param("sort", "title,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("c"))
                .andExpect(jsonPath("$.content[2].title").value("a"));
    }

    @Test
    void rejectsTooLargeSize() throws Exception {
        mvc.perform(get("/test/paging").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void rejectsNegativePage() throws Exception {
        mvc.perform(get("/test/paging").param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void rejectsUnknownSortField() throws Exception {
        mvc.perform(get("/test/paging").param("sort", "secret"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    @Test
    void rejectsNonNumericSizeWithLocalizedMessage() throws Exception {
        var body = mvc.perform(get("/test/paging").param("size", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("size"))
                .andExpect(jsonPath("$.errors[0].message").value("ma nieprawidłowy format"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("java.lang");
    }
}
