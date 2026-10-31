package app.gatemate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableCaching
@EnableScheduling
@org.springframework.data.jpa.repository.config.EnableJpaRepositories(considerNestedRepositories = true)
public class GatemateApplication {
    public static void main(String[] args) {
        adoptPlatformDatabaseUrl(System.getenv("DATABASE_URL"));
        SpringApplication.run(GatemateApplication.class, args);
    }

    static void adoptPlatformDatabaseUrl(String url) {
        if (url == null || !url.matches("^postgres(ql)?://.*")) return;
        var u = java.net.URI.create(url);
        String[] cred = u.getUserInfo() == null ? new String[0] : u.getUserInfo().split(":", 2);
        int port = u.getPort() > 0 ? u.getPort() : 5432;
        System.setProperty("spring.datasource.url", "jdbc:postgresql://" + u.getHost() + ":" + port + u.getPath()
                + (u.getQuery() != null ? "?" + u.getQuery() : ""));
        if (cred.length > 0) System.setProperty("spring.datasource.username", java.net.URLDecoder.decode(cred[0], java.nio.charset.StandardCharsets.UTF_8));
        if (cred.length > 1) System.setProperty("spring.datasource.password", java.net.URLDecoder.decode(cred[1], java.nio.charset.StandardCharsets.UTF_8));
    }
}
