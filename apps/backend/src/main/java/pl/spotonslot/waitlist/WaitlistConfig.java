package pl.spotonslot.waitlist;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(WaitlistProperties.class)
class WaitlistConfig {
}
