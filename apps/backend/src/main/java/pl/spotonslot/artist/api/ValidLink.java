package pl.spotonslot.artist.api;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import pl.spotonslot.artist.domain.LinkKind;

/** An {@code https} link to the given service; {@code null} is valid. Message key {@code ValidLink}. */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidLink.Validator.class)
@interface ValidLink {

    LinkKind value();

    String message() default "{ValidLink}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidLink, String> {

        private LinkKind kind;

        @Override
        public void initialize(ValidLink annotation) {
            kind = annotation.value();
        }

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || kind.accepts(value);
        }
    }
}
