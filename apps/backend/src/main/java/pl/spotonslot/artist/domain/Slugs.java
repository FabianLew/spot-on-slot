package pl.spotonslot.artist.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Public profile addresses ({@code /a/{slug}}): 3–40 lowercase letters, digits and single dashes. */
public final class Slugs {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 40;

    private static final Pattern VALID = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SEPARATORS = Pattern.compile("[^a-z0-9]+");
    private static final String FALLBACK = "artist";

    /** Words that would collide with app routes or look official. */
    private static final Set<String> RESERVED = Set.of(
            "admin", "api", "app", "artist", "artists", "auth", "booking", "bookings", "design", "edit", "help",
            "login", "logout", "me", "new", "profile", "register", "search", "settings", "spotonslot", "support",
            "venue", "venues");

    private Slugs() {
    }

    /** "Łukasz Żółć" becomes "lukasz-zolc"; a name without letters or digits becomes "artist". */
    public static String fromStageName(String stageName) {
        // ł/Ł have no decomposition, so NFD alone would drop them.
        var folded = stageName.replace('ł', 'l').replace('Ł', 'L');
        var ascii = MARKS.matcher(Normalizer.normalize(folded, Normalizer.Form.NFD)).replaceAll("");
        var slug = trimDashes(SEPARATORS.matcher(ascii.toLowerCase(Locale.ROOT)).replaceAll("-"));
        if (slug.length() > MAX_LENGTH) {
            slug = trimDashes(slug.substring(0, MAX_LENGTH));
        }
        return slug.isEmpty() ? FALLBACK : slug;
    }

    /**
     * The {@code attempt}-th address to try for {@code base}: the base itself first, then "base-2", "base-3"…
     * A base that is too short or reserved is always numbered ("dj-1").
     */
    public static String candidate(String base, int attempt) {
        var numbered = attempt > 1 || base.length() < MIN_LENGTH || isReserved(base);
        if (!numbered) {
            return base;
        }
        var suffix = "-" + attempt;
        var room = MAX_LENGTH - suffix.length();
        var head = base.length() > room ? trimDashes(base.substring(0, room)) : base;
        return head + suffix;
    }

    public static boolean isValid(String slug) {
        return slug != null && slug.length() >= MIN_LENGTH && slug.length() <= MAX_LENGTH
                && VALID.matcher(slug).matches();
    }

    public static boolean isReserved(String slug) {
        return RESERVED.contains(slug);
    }

    private static String trimDashes(String value) {
        var start = 0;
        var end = value.length();
        while (start < end && value.charAt(start) == '-') {
            start++;
        }
        while (end > start && value.charAt(end - 1) == '-') {
            end--;
        }
        return value.substring(start, end);
    }
}
