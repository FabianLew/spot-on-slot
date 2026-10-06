package pl.spotonslot.shared.text;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;

/** Links people put on their profiles: absolute {@code https} URLs without credentials. */
public final class HttpsLinks {

    public static final int MAX_LENGTH = 300;

    private HttpsLinks() {
    }

    /**
     * The lowercase host of an acceptable link, without a leading {@code www.} or {@code m.}; empty for anything
     * else (another scheme, user info, no host, too long, malformed).
     */
    public static Optional<String> host(String url) {
        if (url == null || url.length() > MAX_LENGTH) {
            return Optional.empty();
        }
        try {
            var uri = new URI(url);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
                return Optional.empty();
            }
            var host = uri.getHost().toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) {
                host = host.substring(4);
            } else if (host.startsWith("m.")) {
                host = host.substring(2);
            }
            return Optional.of(host);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
    }
}
