package pl.spotonslot.identity;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The first admin account, created at startup when no account has this address ({@code ADMIN_EMAIL},
 * {@code ADMIN_PASSWORD}). Without both nothing is created; later admins are invited in the admin panel.
 */
@ConfigurationProperties("spotonslot.admin")
public record AdminProperties(String email, String password) {
}
