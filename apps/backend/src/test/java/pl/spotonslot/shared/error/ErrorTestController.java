package pl.spotonslot.shared.error;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Hidden
@RestController
@RequestMapping("/test/errors")
class ErrorTestController {

    @GetMapping("/not-found")
    void notFound() {
        throw new NotFoundException("ARTIST_NOT_FOUND", "x");
    }

    @GetMapping("/business")
    void business() {
        throw new BusinessRuleException("BOOKING_SLOT_TAKEN");
    }

    @GetMapping("/optimistic")
    void optimistic() {
        throw new ObjectOptimisticLockingFailureException(Object.class, "id");
    }

    @GetMapping("/boom")
    void boom() {
        throw new IllegalStateException("SELECT secret FROM users");
    }

    @GetMapping(value = "/json-only", produces = "application/json")
    void jsonOnly() {
    }

    @GetMapping("/param")
    void param(@RequestParam String q) {
    }

    @PostMapping("/validated")
    void validated(@Valid @RequestBody Payload payload) {
    }

    record Payload(@NotBlank String nickname, @Size(max = 5) String city) {
    }
}
