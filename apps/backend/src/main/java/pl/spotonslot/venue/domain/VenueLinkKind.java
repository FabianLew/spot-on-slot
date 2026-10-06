package pl.spotonslot.venue.domain;

import java.util.Set;
import lombok.RequiredArgsConstructor;
import pl.spotonslot.shared.text.HttpsLinks;

/** Links a venue can show; an empty host set means any {@code https} site. */
@RequiredArgsConstructor
public enum VenueLinkKind {
    WEBSITE(Set.of()),
    INSTAGRAM(Set.of("instagram.com")),
    FACEBOOK(Set.of("facebook.com", "fb.com"));

    private final Set<String> hosts;

    public boolean accepts(String url) {
        return HttpsLinks.host(url).filter(host -> hosts.isEmpty() || hosts.contains(host)).isPresent();
    }
}
