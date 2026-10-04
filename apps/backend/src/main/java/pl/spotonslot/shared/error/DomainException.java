package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

/**
 * Base type for expected, business-level failures. The {@code code} selects the localized message
 * ({@code error.<code>.title|detail}) and is exposed to clients as the {@code code} problem property.
 */
public abstract class DomainException extends RuntimeException {

    private final String code;
    private final HttpStatus status;
    private final transient Object[] detailArgs;

    protected DomainException(String code, HttpStatus status, Object... detailArgs) {
        super(code);
        this.code = code;
        this.status = status;
        this.detailArgs = detailArgs == null ? new Object[0] : detailArgs;
    }

    public String code() {
        return code;
    }

    public HttpStatus status() {
        return status;
    }

    public Object[] detailArgs() {
        return detailArgs.clone();
    }
}
