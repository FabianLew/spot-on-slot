package pl.spotonslot.artist.domain;

import java.util.Set;
import lombok.RequiredArgsConstructor;
import pl.spotonslot.shared.text.HttpsLinks;

/** Services an artist can link to, each with the hosts its links may point at. */
@RequiredArgsConstructor
public enum LinkKind {
    SOUNDCLOUD(Set.of("soundcloud.com", "on.soundcloud.com")),
    SPOTIFY(Set.of("open.spotify.com", "spotify.link")),
    INSTAGRAM(Set.of("instagram.com")),
    YOUTUBE(Set.of("youtube.com", "music.youtube.com", "youtu.be"));

    private final Set<String> hosts;

    /** An {@code https} URL on one of this service's hosts ({@code www.} and {@code m.} allowed). */
    public boolean accepts(String url) {
        return HttpsLinks.host(url).filter(hosts::contains).isPresent();
    }
}
