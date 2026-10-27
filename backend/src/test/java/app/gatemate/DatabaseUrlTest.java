package app.gatemate;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DatabaseUrlTest {
    @AfterEach
    void clear() {
        System.clearProperty("spring.datasource.url");
        System.clearProperty("spring.datasource.username");
        System.clearProperty("spring.datasource.password");
    }

    @Test
    void convertsPlatformPostgresUrl() {
        GatemateApplication.adoptPlatformDatabaseUrl("postgresql://gm_user:p%40ss@dpg-abc-a/gatemate_db");
        assertEquals("jdbc:postgresql://dpg-abc-a:5432/gatemate_db", System.getProperty("spring.datasource.url"));
        assertEquals("gm_user", System.getProperty("spring.datasource.username"));
        assertEquals("p@ss", System.getProperty("spring.datasource.password"));
    }

    @Test
    void leavesJdbcUrlAlone() {
        GatemateApplication.adoptPlatformDatabaseUrl("jdbc:postgresql://localhost:5432/gatemate");
        assertEquals(null, System.getProperty("spring.datasource.url"));
    }
}
