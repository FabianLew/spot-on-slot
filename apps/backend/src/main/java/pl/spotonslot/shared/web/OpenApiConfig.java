package pl.spotonslot.shared.web;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenAPI spotOnSlotOpenApi(@Value("${spotonslot.version:dev}") String version) {
        return new OpenAPI()
                .info(new Info().title("Spot On Slot API").version(version))
                .components(new Components().addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }
}
