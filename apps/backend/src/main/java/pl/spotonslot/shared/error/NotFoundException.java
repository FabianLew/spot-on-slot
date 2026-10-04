package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

public class NotFoundException extends DomainException {

    public NotFoundException() {
        this("NOT_FOUND");
    }

    public NotFoundException(String code, Object... detailArgs) {
        super(code, HttpStatus.NOT_FOUND, detailArgs);
    }
}
