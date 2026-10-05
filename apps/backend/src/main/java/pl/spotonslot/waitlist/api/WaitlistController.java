package pl.spotonslot.waitlist.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.waitlist.application.WaitlistService;

@RestController
@RequestMapping("/api/v1/waitlist")
@RequiredArgsConstructor
class WaitlistController {

    private final WaitlistService waitlistService;

    /** Always 202 with no body, so the response does not reveal whether the address is already on the list. */
    @PostMapping("/signups")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void signUp(@Valid @RequestBody SignupRequest request) {
        waitlistService.signUp(request.toCommand());
    }
}
