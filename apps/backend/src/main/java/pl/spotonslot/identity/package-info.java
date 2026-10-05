/**
 * Identity: registration with e-mail verification, login, JWT access tokens with rotating refresh tokens, password
 * reset. Roles: ARTIST and VENUE at registration; BOOKER later, ADMIN assigned manually.
 */
@ApplicationModule(displayName = "Identity")
package pl.spotonslot.identity;

import org.springframework.modulith.ApplicationModule;
