package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

public class InvalidRequestException extends DomainException {

    public InvalidRequestException(String code, Object... detailArgs) {
        super(code, HttpStatus.BAD_REQUEST, detailArgs);
    }
}
