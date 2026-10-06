package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

/** The caller is known but may not do this (a role or ownership rule in a module). */
public class ForbiddenException extends DomainException {

    public ForbiddenException(String code, Object... detailArgs) {
        super(code, HttpStatus.FORBIDDEN, detailArgs);
    }
}
