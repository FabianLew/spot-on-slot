package pl.spotonslot.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class MediaIntegrationTest {

    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-000000000001");
    private static final UUID STRANGER = UUID.fromString("0190a5d2-0000-7000-8000-000000000002");

    private final HttpClient http = HttpClient.newHttpClient();

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MediaService mediaService;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM media");
        jdbc.update("DELETE FROM media_upload");
    }

    @Test
    void uploadsAnImageAndServesItsWebpVariants() throws Exception {
        var upload = start(OWNER, "image/jpeg", jpeg(2000, 1000));

        var media = body(as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(1600))
                .andExpect(jsonPath("$.height").value(800)));

        for (var variant : new String[] {"small", "medium", "large"}) {
            var file = http.send(HttpRequest.newBuilder(URI.create(media.at("/variants/" + variant).asText())).build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertThat(file.statusCode()).isEqualTo(200);
            assertThat(new String(file.body(), 8, 4)).isEqualTo("WEBP");
        }
        assertThat(ImageIO.read(new ByteArrayInputStream(download(media.at("/variants/small").asText()))).getWidth())
                .isEqualTo(320);
        // The original is gone and the upload is used up.
        assertThat(httpStatus(upload.url())).isEqualTo(404);
        as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id())).andExpect(status().isNotFound());
        as(STRANGER, get("/api/v1/media/{id}", media.get("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variants.large").value(media.at("/variants/large").asText()));
    }

    @Test
    void refusesUnsupportedAndOversizedUploads() throws Exception {
        startRequest(OWNER, "image/gif", 100)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEDIA_UNSUPPORTED_TYPE"));
        startRequest(OWNER, "image/jpeg", 10L * 1024 * 1024 + 1)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEDIA_TOO_LARGE"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("10 MB")));
        startRequest(OWNER, "image/jpeg", 0).andExpect(status().isBadRequest());
    }

    @Test
    void completingWithoutTheFileIsRefused() throws Exception {
        var body = body(startRequest(OWNER, "image/png", 1234).andExpect(status().isCreated()));

        as(OWNER, post("/api/v1/media/uploads/{id}/complete", body.get("uploadId").asText()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEDIA_FILE_MISSING"));
    }

    @Test
    void aFileThatIsNotAnImageEndsTheUpload() throws Exception {
        var upload = start(OWNER, "image/jpeg", "<?php system($_GET['c']); ?>".getBytes());

        as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEDIA_UNSUPPORTED_TYPE"));
        as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id())).andExpect(status().isNotFound());
        assertThat(httpStatus(upload.url())).isEqualTo(404);
    }

    @Test
    void uploadsAndImagesOfOthersLookMissing() throws Exception {
        var upload = start(OWNER, "image/png", png(400, 300));
        as(STRANGER, post("/api/v1/media/uploads/{id}/complete", upload.id()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_UPLOAD_NOT_FOUND"));

        var media = body(as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id())));
        var id = media.get("id").asText();
        as(STRANGER, delete("/api/v1/media/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_NOT_FOUND"));

        as(OWNER, delete("/api/v1/media/{id}", id)).andExpect(status().isNoContent());
        as(OWNER, get("/api/v1/media/{id}", id)).andExpect(status().isNotFound());
        assertThat(httpStatus(media.at("/variants/large").asText())).isEqualTo(404);
    }

    @Test
    void limitsImagesPerAccount() throws Exception {
        for (int i = 0; i < 199; i++) {
            jdbc.update("""
                    INSERT INTO media (id, created_at, updated_at, version, owner_id, width, height, small_key,
                    medium_key, large_key) VALUES (?, now(), now(), 0, ?, 1, 1, 's', 'm', 'l')""",
                    UUID.randomUUID(), OWNER);
        }
        startRequest(OWNER, "image/png", 100).andExpect(status().isCreated());
        startRequest(OWNER, "image/png", 100)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_QUOTA_EXCEEDED"));
        startRequest(STRANGER, "image/png", 100).andExpect(status().isCreated());
    }

    @Test
    void cleanupRemovesUploadsNeverCompleted() throws Exception {
        var upload = start(OWNER, "image/png", png(10, 10));

        assertThat(mediaService.deleteStaleUploads(Instant.now())).isZero();
        assertThat(mediaService.deleteStaleUploads(Instant.now().plus(Duration.ofHours(25)))).isEqualTo(1);

        assertThat(httpStatus(upload.url())).isEqualTo(404);
        as(OWNER, post("/api/v1/media/uploads/{id}/complete", upload.id())).andExpect(status().isNotFound());
    }

    @Test
    void requiresSignIn() throws Exception {
        mockMvc.perform(post("/api/v1/media/uploads").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private record Upload(String id, String url) {
    }

    /** Steps 1 and 2: asks for an upload link and PUTs the file there like a browser would. */
    private Upload start(UUID owner, String contentType, byte[] file) throws Exception {
        var body = body(startRequest(owner, contentType, file.length).andExpect(status().isCreated())
                .andExpect(jsonPath("$.method").value("PUT")));
        // Only headers a browser can send: no checksum the browser would have to compute first.
        assertThat(body.get("headers").properties()).extracting(Map.Entry::getKey).containsExactly("content-type");
        assertThat(body.get("url").asText()).doesNotContainIgnoringCase("checksum");
        var put = HttpRequest.newBuilder(URI.create(body.get("url").asText()))
                .PUT(HttpRequest.BodyPublishers.ofByteArray(file));
        body.get("headers").fields().forEachRemaining(header -> put.header(header.getKey(), header.getValue().asText()));
        assertThat(http.send(put.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
        return new Upload(body.get("uploadId").asText(), body.get("url").asText());
    }

    private ResultActions startRequest(UUID owner, String contentType, long size) throws Exception {
        return as(owner, post("/api/v1/media/uploads")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contentType", contentType, "size", size))));
    }

    private ResultActions as(UUID user, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))));
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private byte[] download(String url) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofByteArray()).body();
    }

    /** Status of a plain GET; the presigned PUT link without its query is the object's address. */
    private int httpStatus(String url) throws Exception {
        var plain = URI.create(url.split("\\?")[0]);
        return http.send(HttpRequest.newBuilder(plain).build(), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private static byte[] jpeg(int width, int height) throws IOException {
        return encode(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "jpeg");
    }

    private static byte[] png(int width, int height) throws IOException {
        return encode(new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB), "png");
    }

    private static byte[] encode(BufferedImage image, String format) throws IOException {
        var out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }
}
