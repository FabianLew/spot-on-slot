package pl.spotonslot.artist.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.application.ArtistProfileService;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;

/** The artist profile as its owner sees it, real name and photo links included; null without a profile. */
@Component
@RequiredArgsConstructor
class ArtistPersonalData implements PersonalDataSection {

    private final ArtistProfileService profiles;
    private final ArtistMapper mapper;

    @Override
    public String key() {
        return "artistProfile";
    }

    @Override
    @Transactional(readOnly = true)
    public Object export(AccountInfo account) {
        return profiles.hasProfile(account.id()) ? mapper.toResponse(profiles.getForOwner(account.id())) : null;
    }
}
