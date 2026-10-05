package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

public class ConflictException extends DomainException {

    public ConflictException() {
        this("CONFLICT");
    }

    public ConflictException(String code, Object... detailArgs) {
        super(code, HttpStatus.CONFLICT, detailArgs);
    }
}
