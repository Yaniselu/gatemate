package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ActiveProfiles;

/** Production starts with lazy beans; the scheduled jobs must still exist, or live alerts silently stop. */
@SpringBootTest(properties = "spring.main.lazy-initialization=true")
@ActiveProfiles("test")
class StartupTest {
    @Autowired ConfigurableApplicationContext ctx;

    @Test
    void scheduledJobsStartEvenWithLazyBeans() {
        var beans = ctx.getBeanFactory();
        assertThat(beans.containsSingleton("liveStatusJob")).as("LiveStatusJob created").isTrue();
        assertThat(beans.containsSingleton("flightStatusJob")).as("FlightStatusJob created").isTrue();
    }
}
