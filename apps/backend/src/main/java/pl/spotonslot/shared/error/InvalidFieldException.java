package pl.spotonslot.shared.error;

/**
 * A 400 about one request field (e.g. a wrong current password): the problem lists it in {@code errors[]} like a
 * validation error, with the code and the localized detail as its message, so forms show it at the field.
 */
public class InvalidFieldException extends InvalidRequestException {

    private final String field;

    public InvalidFieldException(String code, String field, Object... detailArgs) {
        super(code, detailArgs);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
