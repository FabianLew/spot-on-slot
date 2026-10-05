package pl.spotonslot.media.domain;

/** Stored sizes of an image, by the length of its longer side. */
public enum Variant {
    SMALL(320),
    MEDIUM(800),
    LARGE(1600);

    private final int longestSide;

    Variant(int longestSide) {
        this.longestSide = longestSide;
    }

    public int longestSide() {
        return longestSide;
    }
}
