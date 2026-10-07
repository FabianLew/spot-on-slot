package pl.spotonslot.identity;

/**
 * One module's part of the data export ("download my data"). Every module that stores data about people implements
 * it; a test checks that each module with tables does. The result is written as JSON under {@link #key()}, so it
 * should be records, lists and maps; images go out as links.
 */
public interface PersonalDataSection {

    /** The section's name in the export, e.g. {@code "bookings"}. */
    String key();

    /** What the module holds about the account; null or an empty list when nothing. */
    Object export(AccountInfo account);
}
