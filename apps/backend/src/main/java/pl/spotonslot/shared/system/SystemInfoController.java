package pl.spotonslot.shared.system;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/system")
public class SystemInfoController {

    @Value("${spotonslot.version:dev}")
    private final String version;

    @GetMapping("/info")
    public SystemInfo info() {
        return new SystemInfo("spot-on-slot", version);
    }

    public record SystemInfo(String name, String version) {
    }
}
