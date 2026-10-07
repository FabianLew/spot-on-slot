package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

/** The caller hit a limit (attempts, frequency); trying again later works. */
public class TooManyRequestsException extends DomainException {

    public TooManyRequestsException(String code, Object... detailArgs) {
        super(code, HttpStatus.TOO_MANY_REQUESTS, detailArgs);
    }
}
