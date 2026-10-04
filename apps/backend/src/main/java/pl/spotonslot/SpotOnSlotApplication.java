package pl.spotonslot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

@Modulithic(sharedModules = "shared")
@SpringBootApplication
public class SpotOnSlotApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpotOnSlotApplication.class, args);
    }
}
