package pl.spotonslot.artist.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;

/** Services an artist can link to, each with the hosts its links may point at. */
@RequiredArgsConstructor
public enum LinkKind {
    SOUNDCLOUD(Set.of("soundcloud.com", "on.soundcloud.com")),
    SPOTIFY(Set.of("open.spotify.com", "spotify.link")),
    INSTAGRAM(Set.of("instagram.com")),
    YOUTUBE(Set.of("youtube.com", "music.youtube.com", "youtu.be"));

    public static final int MAX_LENGTH = 300;

    private final Set<String> hosts;

    /** An {@code https} URL on one of this service's hosts ({@code www.} and {@code m.} allowed). */
    public boolean accepts(String url) {
        if (url == null || url.length() > MAX_LENGTH) {
            return false;
        }
        try {
            var uri = new URI(url);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
                return false;
            }
            var host = uri.getHost().toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) {
                host = host.substring(4);
            } else if (host.startsWith("m.")) {
                host = host.substring(2);
            }
            return hosts.contains(host);
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
