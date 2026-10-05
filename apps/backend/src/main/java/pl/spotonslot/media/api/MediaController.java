package pl.spotonslot.media.api;

import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.media.domain.Media;
import pl.spotonslot.media.domain.Variant;

@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
class MediaController {

    private final MediaService mediaService;

    /** Step 1: a presigned link for sending one image straight to storage. */
    @PostMapping("/uploads")
    @ResponseStatus(HttpStatus.CREATED)
    UploadResponse startUpload(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody StartUploadRequest request) {
        var started = mediaService.startUpload(owner(jwt), request.contentType(), request.size());
        return new UploadResponse(started.uploadId(), started.put().url(), "PUT", started.put().headers(),
                started.expiresAt());
    }

    /** Step 3, after the PUT: checks the file and stores its WebP variants. */
    @PostMapping("/uploads/{uploadId}/complete")
    @ResponseStatus(HttpStatus.CREATED)
    MediaResponse complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID uploadId) {
        return toResponse(mediaService.complete(owner(jwt), uploadId));
    }

    @GetMapping("/{id}")
    MediaResponse get(@PathVariable UUID id) {
        return toResponse(mediaService.get(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        mediaService.delete(owner(jwt), id);
    }

    private MediaResponse toResponse(Media image) {
        return new MediaResponse(image.getId(), image.getWidth(), image.getHeight(), new MediaResponse.Variants(
                mediaService.url(image, Variant.SMALL),
                mediaService.url(image, Variant.MEDIUM),
                mediaService.url(image, Variant.LARGE)));
    }

    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
