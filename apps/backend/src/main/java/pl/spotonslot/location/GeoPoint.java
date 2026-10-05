package pl.spotonslot.location;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** WGS 84 coordinates in degrees. */
public record GeoPoint(double latitude, double longitude) {

    /** Grid step for people's locations: 0.01° is about 1.1 km north-south and 0.7 km east-west in Poland. */
    static final int APPROXIMATION_DECIMALS = 2;

    public GeoPoint {
        if (!(latitude >= -90 && latitude <= 90) || !(longitude >= -180 && longitude <= 180)) {
            throw new IllegalArgumentException("Coordinates out of range: " + latitude + ", " + longitude);
        }
    }

    /** This point snapped to the 0.01° grid, so a stored location never reveals an exact address. */
    public GeoPoint approximate() {
        return new GeoPoint(round(latitude), round(longitude));
    }

    private static double round(double degrees) {
        return BigDecimal.valueOf(degrees).setScale(APPROXIMATION_DECIMALS, RoundingMode.HALF_UP).doubleValue();
    }
}
