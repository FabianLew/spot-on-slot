package pl.spotonslot.shared.web;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documents the RFC 9457 error body ({@code application/problem+json}) in the OpenAPI spec, so the generated API
 * client can type error responses.
 */
@Configuration
public class ProblemDetailOpenApiCustomizer {

    static final String PROBLEM_SCHEMA = "ProblemDetail";
    private static final String PROBLEM_JSON = "application/problem+json";
    private static final Map<String, String> ERROR_RESPONSES = Map.of(
            "400", "Invalid request",
            "401", "Authentication required",
            "403", "Access denied",
            "404", "Resource not found",
            "500", "Unexpected server error");

    @Bean
    OpenApiCustomizer problemDetailCustomizer() {
        return this::customize;
    }

    private void customize(OpenAPI openApi) {
        if (openApi.getComponents() == null) {
            openApi.setComponents(new Components());
        }
        openApi.getComponents().addSchemas(PROBLEM_SCHEMA, problemDetailSchema());

        Schema<?> reference = new Schema<>().$ref("#/components/schemas/" + PROBLEM_SCHEMA);
        if (openApi.getPaths() == null) {
            return;
        }
        openApi.getPaths().values().forEach(pathItem -> pathItem.readOperations().forEach(operation -> {
            ERROR_RESPONSES.forEach((status, description) -> {
                if (operation.getResponses().get(status) == null) {
                    operation.getResponses().addApiResponse(status, new ApiResponse()
                            .description(description)
                            .content(new Content().addMediaType(PROBLEM_JSON, new MediaType().schema(reference))));
                }
            });
        }));
    }

    private Schema<?> problemDetailSchema() {
        Schema<?> fieldError = new ObjectSchema()
                .addProperty("field", new StringSchema())
                .addProperty("code", new StringSchema())
                .addProperty("message", new StringSchema())
                .required(List.of("field", "code", "message"));
        return new ObjectSchema()
                .addProperty("type", new StringSchema().example("about:blank"))
                .addProperty("title", new StringSchema())
                .addProperty("status", new IntegerSchema())
                .addProperty("detail", new StringSchema())
                .addProperty("instance", new StringSchema())
                .addProperty("code", new StringSchema().description("Stable machine-readable error code"))
                .addProperty("requestId", new StringSchema().description("Echo of the X-Request-Id header"))
                .addProperty("errors", new ArraySchema().items(fieldError)
                        .description("Field-level errors, present only for validation failures"))
                .required(List.of("type", "title", "status", "code", "requestId"));
    }
}
