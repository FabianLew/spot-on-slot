package pl.spotonslot;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class SpotOnSlotApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesMigrationsWithPostgis() {
        String version = jdbcTemplate.queryForObject("SELECT postgis_version()", String.class);
        assertThat(version).isNotBlank();
    }

    @Test
    void appliesTestMigrations() {
        Integer count = jdbcTemplate.queryForObject("SELECT count(*) FROM test_note", Integer.class);
        assertThat(count).isZero();
    }

    @Test
    void exposesPublicSystemInfo() throws Exception {
        mockMvc.perform(get("/api/v1/system/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("spot-on-slot"));
    }

    @Test
    void securesOtherEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/bookings"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    /**
     * Also exports the spec to build/openapi/openapi.json, which packages/api-client generates its types from.
     */
    @Test
    void exposesOpenApiSpec() throws Exception {
        String spec = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.components.schemas.ProblemDetail.properties.code").exists())
                .andExpect(jsonPath("$.components.schemas.ProblemDetail.properties.errors").exists())
                .andExpect(jsonPath("$.paths['/api/v1/system/info'].get.responses['500'].content['application/problem+json']").exists())
                .andReturn().getResponse().getContentAsString();

        assertThat(JsonPath.<Map<String, Object>>read(spec, "$.paths").keySet())
                .noneMatch(path -> path.startsWith("/test/"));
        // Error responses are added in status order, so the exported spec (and generated client) is deterministic.
        var responses = new ObjectMapper().readTree(spec).at("/paths/~1api~1v1~1system~1info/get/responses");
        assertThat(responses.fieldNames()).toIterable().containsExactly("200", "400", "401", "403", "404", "500");

        Path output = Path.of("build", "openapi", "openapi.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, spec);
    }
}
