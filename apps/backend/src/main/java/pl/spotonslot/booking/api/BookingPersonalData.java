package pl.spotonslot.booking.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.booking.api.BookingDtos.BookingResponse;
import pl.spotonslot.booking.application.BookingService;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;

/** Bookings as the artist or of the person's venues, with every step and its message. */
@Component
@RequiredArgsConstructor
class BookingPersonalData implements PersonalDataSection {

    private final BookingService bookings;

    @Override
    public String key() {
        return "bookings";
    }

    @Override
    public Object export(AccountInfo account) {
        return bookings.listAllOf(account.id()).stream().map(BookingResponse::of).toList();
    }
}
