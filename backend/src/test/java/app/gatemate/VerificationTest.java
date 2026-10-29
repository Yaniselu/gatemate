package app.gatemate;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.gatemate.auth.MailService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
class VerificationTest {
    @Autowired WebApplicationContext ctx;
    @Autowired JsonMapper json;
    @MockitoBean MailService mail;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
        when(mail.enabled()).thenReturn(true);
    }

    JsonNode post(String url, String token, String body, int status) throws Exception {
        var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(body).with(r -> {
            r.setRemoteAddr("10.1." + (int) (Math.random() * 250) + "." + (int) (Math.random() * 250));
            return r;
        });
        if (token != null) req.header("Authorization", "Bearer " + token);
        String res = mvc.perform(req).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
        return res.isBlank() ? null : json.readTree(res);
    }

    @Test
    void signUpSendsACodeThatConfirmsTheEmail() throws Exception {
        String email = "v+" + UUID.randomUUID() + "@example.com";
        var s = post("/api/v1/auth/register", null, "{\"name\":\"Ana Popescu\",\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);
        String access = s.get("accessToken").asString();
        org.junit.jupiter.api.Assertions.assertFalse(s.path("user").path("emailVerified").asBoolean());
        var code = ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerificationCode(eq(email), anyString(), code.capture());
        org.junit.jupiter.api.Assertions.assertTrue(code.getValue().matches("\\d{6}"));

        String wrong = code.getValue().equals("000000") ? "111111" : "000000";
        var bad = post("/api/v1/me/email/verify", access, "{\"code\":\"" + wrong + "\"}", 400);
        org.junit.jupiter.api.Assertions.assertTrue(bad.path("message").asString().contains("4 tries left"));
        var ok = post("/api/v1/me/email/verify", access, "{\"code\":\"" + code.getValue() + "\"}", 200);
        org.junit.jupiter.api.Assertions.assertTrue(ok.path("emailVerified").asBoolean());
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$.emailVerified").value(true));
    }

    @Test
    void resendingIsLimited() throws Exception {
        String email = "r+" + UUID.randomUUID() + "@example.com";
        String access = post("/api/v1/auth/register", null, "{\"name\":\"Ana\",\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200)
                .get("accessToken").asString();
        // The sign-up mail used this minute's allowance.
        post("/api/v1/me/email/code", access, "{}", 429);
    }

    @Test
    void passwordResetWithAnEmailedCode() throws Exception {
        String email = "p+" + UUID.randomUUID() + "@example.com";
        post("/api/v1/auth/register", null, "{\"name\":\"Ana\",\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);
        post("/api/v1/auth/password-reset", null, "{\"email\":\"" + email + "\"}", 204);
        // Unknown addresses get the same answer.
        post("/api/v1/auth/password-reset", null, "{\"email\":\"nobody+" + UUID.randomUUID() + "@example.com\"}", 204);
        var code = ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordResetCode(eq(email), anyString(), code.capture());

        post("/api/v1/auth/password-reset/confirm", null, "{\"email\":\"" + email + "\",\"code\":\"" + (code.getValue().equals("123456") ? "654321" : "123456")
                + "\",\"password\":\"Another-Horse-77!\"}", 400);
        post("/api/v1/auth/password-reset/confirm", null, "{\"email\":\"" + email + "\",\"code\":\"" + code.getValue() + "\",\"password\":\"Another-Horse-77!\"}", 204);
        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 401);
        var s = post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"Another-Horse-77!\"}", 200);
        org.junit.jupiter.api.Assertions.assertTrue(s.path("user").path("emailVerified").asBoolean());
        // A code works once.
        post("/api/v1/auth/password-reset/confirm", null, "{\"email\":\"" + email + "\",\"code\":\"" + code.getValue() + "\",\"password\":\"Third-Horse-99!x\"}", 400);
    }

    @Test
    void guessingOnePasswordFromManyIpsIsStopped() throws Exception {
        String email = "g+" + UUID.randomUUID() + "@example.com";
        post("/api/v1/auth/register", null, "{\"name\":\"Ana\",\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);
        int limited = 0;
        for (int i = 0; i < 14; i++) {
            var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"guess-" + i + "-xxxxx\"}");
            final int n = i;
            req.with(r -> {
                r.setRemoteAddr("10.9." + n + ".1");
                return r;
            });
            if (mvc.perform(req).andReturn().getResponse().getStatus() == 429) limited++;
        }
        org.junit.jupiter.api.Assertions.assertTrue(limited >= 4, "attempts after the 10th should be refused, got " + limited);
        // Even the right password waits until the limit passes.
        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 429);
    }
}
