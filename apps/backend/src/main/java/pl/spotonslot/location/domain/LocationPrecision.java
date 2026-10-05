package pl.spotonslot.location.domain;

/** People's locations are always approximate; exact points are for public addresses such as venues (B5). */
public enum LocationPrecision {
    APPROXIMATE,
    EXACT
}
