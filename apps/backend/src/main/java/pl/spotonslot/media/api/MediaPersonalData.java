package pl.spotonslot.media.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.media.domain.Variant;

/** Every image the person uploaded, as public links. */
@Component
@RequiredArgsConstructor
class MediaPersonalData implements PersonalDataSection {

    private final MediaService media;

    @Override
    public String key() {
        return "media";
    }

    @Override
    public Object export(AccountInfo account) {
        return media.listOf(account.id()).stream()
                .map(image -> new MediaResponse(image.getId(), image.getWidth(), image.getHeight(),
                        new MediaResponse.Variants(media.url(image, Variant.SMALL), media.url(image, Variant.MEDIUM),
                                media.url(image, Variant.LARGE))))
                .toList();
    }
}
