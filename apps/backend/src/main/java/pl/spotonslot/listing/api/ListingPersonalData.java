package pl.spotonslot.listing.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.listing.api.ListingDtos.ListingResponse;
import pl.spotonslot.listing.application.ListingService;

/** Listings the person posted (or that are theirs as the artist), in every status. */
@Component
@RequiredArgsConstructor
class ListingPersonalData implements PersonalDataSection {

    private final ListingService listings;

    @Override
    public String key() {
        return "listings";
    }

    @Override
    public Object export(AccountInfo account) {
        return listings.listOfPerson(account.id()).stream().map(ListingResponse::of).toList();
    }
}
