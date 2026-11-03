package app.gatemate;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class LegalPagesTest {
    @Autowired WebApplicationContext context;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void storePagesArePublicAndLocked() throws Exception {
        for (String page : new String[] {"privacy", "terms", "guidelines", "delete-account"}) {
            mvc.perform(get("/legal/" + page + ".html"))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("Gatemate")))
                    .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                    .andExpect(header().string("X-Frame-Options", "DENY"));
        }
        mvc.perform(post("/legal/privacy.html")).andExpect(status().is4xxClientError());
        mvc.perform(get("/api/v1/trips")).andExpect(status().isUnauthorized());
    }
}
