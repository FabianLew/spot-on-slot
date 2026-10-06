package pl.spotonslot.venue.api;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import pl.spotonslot.venue.domain.VenueLinkKind;

/** An {@code https} link of the given kind; {@code null} is valid. Shares the message key {@code ValidLink}. */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidVenueLink.Validator.class)
@interface ValidVenueLink {

    VenueLinkKind value();

    String message() default "{ValidLink}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidVenueLink, String> {

        private VenueLinkKind kind;

        @Override
        public void initialize(ValidVenueLink annotation) {
            kind = annotation.value();
        }

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || kind.accepts(value);
        }
    }
}
