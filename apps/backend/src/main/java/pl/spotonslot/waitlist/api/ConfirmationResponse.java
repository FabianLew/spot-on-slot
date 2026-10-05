package pl.spotonslot.waitlist.api;

import pl.spotonslot.waitlist.domain.WaitlistStatus;

public record ConfirmationResponse(WaitlistStatus status) {
}
