package pl.spotonslot.waitlist;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(WaitlistProperties.class)
@EnableScheduling
class WaitlistConfig {
}
