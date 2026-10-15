package pl.spotonslot.moderation.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidFieldException;
import pl.spotonslot.shared.error.NotFoundException;
import pl.spotonslot.shared.error.TooManyRequestsException;

/** Moderation failures with their problem codes. */
public final class ModerationErrors {

    private ModerationErrors() {
    }

    /** The reported thing does not exist or is not visible to the reporter (unpublished, ended, not their chat). */
    public static class TargetNotFound extends NotFoundException {
        public TargetNotFound() {
            super("MODERATION_TARGET_NOT_FOUND");
        }
    }

    /** ARTIST and VENUE are reported by {@code slug}, LISTING and CONVERSATION by {@code id}. */
    public static class TargetRequired extends InvalidFieldException {
        public TargetRequired(String field) {
            super("MODERATION_TARGET_REQUIRED", field);
        }
    }

    public static class DescriptionRequired extends InvalidFieldException {
        public DescriptionRequired() {
            super("MODERATION_DESCRIPTION_REQUIRED", "description");
        }
    }

    public static class AlreadyReported extends ConflictException {
        public AlreadyReported() {
            super("MODERATION_ALREADY_REPORTED");
        }
    }

    public static class ReportLimit extends TooManyRequestsException {
        public ReportLimit() {
            super("MODERATION_REPORT_LIMIT");
        }
    }

    public static class OwnTarget extends BusinessRuleException {
        public OwnTarget() {
            super("MODERATION_OWN_TARGET");
        }
    }

    /** Nothing to restore: the profile or venue is not hidden by moderation. */
    public static class NotHidden extends ConflictException {
        public NotHidden() {
            super("MODERATION_NOT_HIDDEN");
        }
    }

    public static class AlreadyClosed extends ConflictException {
        public AlreadyClosed() {
            super("MODERATION_ALREADY_CLOSED");
        }
    }
}
