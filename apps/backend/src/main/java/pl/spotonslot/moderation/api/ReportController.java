package pl.spotonslot.moderation.api;

import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.moderation.api.ModerationDtos.ReportCreated;
import pl.spotonslot.moderation.api.ModerationDtos.ReportRequest;
import pl.spotonslot.moderation.application.ReportService;
import pl.spotonslot.moderation.application.ReportTarget;

/** Reports of abuse from any signed-in user; the answer only confirms it was received. */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
class ReportController {

    private final ReportService reports;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ReportCreated report(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReportRequest request) {
        var report = reports.report(UUID.fromString(jwt.getSubject()),
                new ReportTarget(request.kind(), request.slug(), request.id()), request.reason(),
                request.description());
        return new ReportCreated(report.getId(), report.getCreatedAt());
    }
}
