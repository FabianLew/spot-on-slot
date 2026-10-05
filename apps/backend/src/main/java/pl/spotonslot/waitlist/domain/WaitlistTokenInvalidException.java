package pl.spotonslot.waitlist.domain;

import pl.spotonslot.shared.error.NotFoundException;

/** No sign-up has this confirmation token: it was never issued or has been replaced by a newer one. */
public class WaitlistTokenInvalidException extends NotFoundException {

    public WaitlistTokenInvalidException() {
        super("WAITLIST_TOKEN_INVALID");
    }
}
