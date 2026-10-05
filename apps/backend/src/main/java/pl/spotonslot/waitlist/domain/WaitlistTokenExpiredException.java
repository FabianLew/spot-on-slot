package pl.spotonslot.waitlist.domain;

import pl.spotonslot.shared.error.BusinessRuleException;

/** The confirmation token is past its expiry; the user has to sign up again to get a new one. */
public class WaitlistTokenExpiredException extends BusinessRuleException {

    public WaitlistTokenExpiredException() {
        super("WAITLIST_TOKEN_EXPIRED");
    }
}
