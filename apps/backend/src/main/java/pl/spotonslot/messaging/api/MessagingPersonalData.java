package pl.spotonslot.messaging.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.messaging.application.MessagingAccountService;

/** Conversations as the artist and of the person's venues, with every message. */
@Component
@RequiredArgsConstructor
class MessagingPersonalData implements PersonalDataSection {

    private final MessagingAccountService accounts;

    @Override
    public String key() {
        return "conversations";
    }

    @Override
    public Object export(AccountInfo account) {
        return accounts.export(account.id());
    }
}
