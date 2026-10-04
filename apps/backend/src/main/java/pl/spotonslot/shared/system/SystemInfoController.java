package pl.spotonslot.shared.system;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
public class SystemInfoController {

    private final String version;

    SystemInfoController(@Value("${spotonslot.version:dev}") String version) {
        this.version = version;
    }

    @GetMapping("/info")
    public SystemInfo info() {
        return new SystemInfo("spot-on-slot", version);
    }

    public record SystemInfo(String name, String version) {
    }
}
