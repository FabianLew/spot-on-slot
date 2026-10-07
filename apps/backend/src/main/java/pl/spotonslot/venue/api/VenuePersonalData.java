package pl.spotonslot.venue.api;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.venue.api.VenueDtos.InvitationResponse;
import pl.spotonslot.venue.api.VenueDtos.VenueResponse;
import pl.spotonslot.venue.application.VenueService;
import pl.spotonslot.venue.application.VenueTeamService;

/** The venues whose team the person is in (with their role) and the invitations they sent. */
@Component
@RequiredArgsConstructor
class VenuePersonalData implements PersonalDataSection {

    record VenuesExport(List<VenueResponse> venues, List<InvitationResponse> invitationsSent) {
    }

    private final VenueService venues;
    private final VenueTeamService teams;
    private final VenueMapper mapper;

    @Override
    public String key() {
        return "venues";
    }

    @Override
    public Object export(AccountInfo account) {
        return new VenuesExport(venues.listMine(account.id()).stream().map(mapper::toResponse).toList(),
                teams.invitationsSentBy(account.id()).stream().map(VenueMapper::toResponse).toList());
    }
}
