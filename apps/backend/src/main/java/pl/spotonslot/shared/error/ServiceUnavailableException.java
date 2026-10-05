package pl.spotonslot.shared.error;

import org.springframework.http.HttpStatus;

/** An external dependency (e.g. the geocoder) did not answer; the client may retry later. */
public class ServiceUnavailableException extends DomainException {

    public ServiceUnavailableException(String code, Object... detailArgs) {
        super(code, HttpStatus.SERVICE_UNAVAILABLE, detailArgs);
    }
}
