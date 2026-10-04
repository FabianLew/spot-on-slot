/**
 * Shared kernel: cross-cutting infrastructure (security, errors, pagination) visible to every module.
 */
@ApplicationModule(displayName = "Shared", type = ApplicationModule.Type.OPEN)
package pl.spotonslot.shared;

import org.springframework.modulith.ApplicationModule;
