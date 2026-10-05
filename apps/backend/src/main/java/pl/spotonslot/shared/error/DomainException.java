package pl.spotonslot.shared.error;

import lombok.Getter;
import lombok.experimental.Accessors;
import org.springframework.http.HttpStatus;

/**
 * Base type for expected, business-level failures. The {@code code} selects the localized message
 * ({@code error.<code>.title|detail}) and is exposed to clients as the {@code code} problem property.
 */
public abstract class DomainException extends RuntimeException {

    @Getter
    @Accessors(fluent = true)
    private final String code;

    @Getter
    @Accessors(fluent = true)
    private final HttpStatus status;

    private final transient Object[] detailArgs;

    protected DomainException(String code, HttpStatus status, Object... detailArgs) {
        super(code);
        this.code = code;
        this.status = status;
        this.detailArgs = detailArgs == null ? new Object[0] : detailArgs;
    }

    public Object[] detailArgs() {
        return detailArgs.clone();
    }
}
