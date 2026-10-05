package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

public class BusinessRuleException extends DomainException {

    public BusinessRuleException(String code, Object... detailArgs) {
        super(code, HttpStatus.UNPROCESSABLE_ENTITY, detailArgs);
    }
}
