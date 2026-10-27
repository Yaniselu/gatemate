package app.gatemate;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
class ApiFlowTest {
    @Autowired WebApplicationContext ctx;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
    }

    JsonNode post(String url, String token, String body, int status) throws Exception {
        var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(body).with(r -> {
            r.setRemoteAddr("10.0.0." + (int) (Math.random() * 250));
            return r;
        });
        if (token != null) req.header("Authorization", "Bearer " + token);
        String res = mvc.perform(req).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
        return res.isBlank() ? null : json.readTree(res);
    }

    JsonNode register(String email) throws Exception {
        return register(email, "Ana Popescu");
    }

    JsonNode register(String email, String name) throws Exception {
        return post("/api/v1/auth/register", null, "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);
    }

    @Test
    void registerLoginRefreshWithReuseDetection() throws Exception {
        String email = "ana+" + UUID.randomUUID() + "@example.com";
        var s = register(email);
        String access = s.get("accessToken").asString();
        String rt1 = s.get("refreshToken").asString();

        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        // Tamper with the payload (e.g. try to change the subject): the signature no longer matches.
        String[] parts = access.split("\\.");
        String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1])).replaceFirst("\"sub\":\"[^\"]+\"", "\"sub\":\"" + UUID.randomUUID() + "\"");
        String forged = parts[0] + "." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes()) + "." + parts[2];
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
        // An unsigned token ("alg":"none") is rejected too.
        String none = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes()) + "." + parts[1] + ".";
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + none)).andExpect(status().isUnauthorized());

        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"wrong-password\"}", 401);
        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);

        String rt2 = post("/api/v1/auth/refresh", null, "{\"refreshToken\":\"" + rt1 + "\"}", 200).get("refreshToken").asString();
        // Re-using the old token revokes the whole family, including rt2.
        post("/api/v1/auth/refresh", null, "{\"refreshToken\":\"" + rt1 + "\"}", 401);
        post("/api/v1/auth/refresh", null, "{\"refreshToken\":\"" + rt2 + "\"}", 401);
    }

    @Test
    void corsPreflightAllowsConfiguredOriginsOnly() throws Exception {
        mvc.perform(options("/api/v1/auth/register").header("Origin", "http://localhost:4200").header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type")).andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
        mvc.perform(options("/api/v1/auth/register").header("Origin", "https://evil.example").header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void weakPasswordsAreRejected() throws Exception {
        post("/api/v1/auth/register", null, "{\"name\":\"X\",\"email\":\"weak@example.com\",\"password\":\"password123\"}", 400);
    }

    @Test
    void boardingPassMustBelongToTheAccount() throws Exception {
        String access = register("pass+" + UUID.randomUUID() + "@example.com", "Ana").get("accessToken").asString();
        int julian = LocalDate.now().plusDays(10).getDayOfYear();
        String barcode = BcbpAndNameTest.pass("POPESCU/ANA", "QWE" + (int) (Math.random() * 900 + 100), "OTP", "LTN", "W6", "3301", julian, "012A");
        String claim = "{\"method\":\"pass\",\"barcode\":\"" + barcode + "\"}";

        // No legal name yet.
        post("/api/v1/flights/claim", access, claim, 422);

        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ion\",\"legalLastName\":\"Ionescu\"}")).andExpect(status().isOk());
        post("/api/v1/flights/claim", access, claim, 403);

        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isOk());
        var trip = post("/api/v1/flights/claim", access, claim, 200);
        org.junit.jupiter.api.Assertions.assertEquals("verified", trip.path("flights").get(0).path("verification").path("status").asString());

        // The same ticket can't be claimed twice — by anyone.
        post("/api/v1/flights/claim", access, claim, 409);
        String other = register("other+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isOk());
        post("/api/v1/flights/claim", other, claim, 409);

        mvc.perform(get("/api/v1/trips").header("Authorization", "Bearer " + access)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].destination.code").value("LTN"));
        // Another user cannot see someone else's trip.
        mvc.perform(get("/api/v1/trips").header("Authorization", "Bearer " + other)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void manualFlightIsUnverifiedAndChatWorks() throws Exception {
        String access = register("man+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        var trip = post("/api/v1/flights", access, "{\"carrier\":\"RO\",\"flightNumber\":\"301\",\"from\":\"OTP\",\"to\":\"CDG\",\"date\":\""
                + LocalDate.now().plusDays(5) + "T10:30:00\"}", 200);
        org.junit.jupiter.api.Assertions.assertEquals("unverified", trip.path("flights").get(0).path("verification").path("status").asString());
        String chatId = trip.path("chatId").asString();
        post("/api/v1/chats/" + chatId + "/messages", access, "{\"text\":\"Hello team\",\"clientId\":\"c-1\"}", 200);
        // Idempotent on clientId.
        post("/api/v1/chats/" + chatId + "/messages", access, "{\"text\":\"Hello team\",\"clientId\":\"c-1\"}", 200);
        mvc.perform(get("/api/v1/chats/" + chatId + "/messages").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$", hasSize(1)));

        String outsider = register("out+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(get("/api/v1/chats/" + chatId + "/messages").header("Authorization", "Bearer " + outsider)).andExpect(status().isNotFound());

        // Add a checklist item (members only).
        String tripId = trip.path("id").asString();
        post("/api/v1/trips/" + tripId + "/checklist", access, "{\"label\":\"Plug adapter\",\"category\":\"packing\"}", 200);
        post("/api/v1/trips/" + tripId + "/checklist", register("x+" + UUID.randomUUID() + "@example.com").get("accessToken").asString(),
                "{\"label\":\"Nope\",\"category\":\"packing\"}", 404);

        // Invite → accept → member.
        String url = post("/api/v1/invites", access, "{\"targetId\":\"" + trip.path("id").asString() + "\"}", 200).path("url").asString();
        String token = url.substring(url.lastIndexOf('/') + 1);
        post("/api/v1/invites/" + token + "/accept", outsider, "{}", 200);
        mvc.perform(get("/api/v1/chats/" + chatId + "/messages").header("Authorization", "Bearer " + outsider)).andExpect(status().isOk());
    }

    @Test
    void accountDeletionRemovesEverything() throws Exception {
        var s = register("del+" + UUID.randomUUID() + "@example.com");
        String access = s.get("accessToken").asString();
        post("/api/v1/flights", access, "{\"carrier\":\"W6\",\"flightNumber\":\"3301\",\"from\":\"OTP\",\"to\":\"LTN\",\"date\":\"" + LocalDate.now().plusDays(3) + "T06:00:00\"}", 200);
        mvc.perform(delete("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(status().isNoContent());
        post("/api/v1/auth/refresh", null, "{\"refreshToken\":\"" + s.get("refreshToken").asString() + "\"}", 401);
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(status().isNotFound());
    }

    @Test
    void adminRoutesNeedAdmin() throws Exception {
        String access = register("adm+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(get("/api/v1/admin/reports").header("Authorization", "Bearer " + access)).andExpect(status().isForbidden());
    }

    @Test
    void publicDataEndpointsValidateInput() throws Exception {
        mvc.perform(get("/api/v1/fx").param("from", "EUR").param("to", "XXX")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/fx").param("from", "EUR").param("to", "EUR")).andExpect(status().isOk()).andExpect(jsonPath("$.rate").value(1.0));
        mvc.perform(get("/api/v1/countries/ES/holidays").param("year", "2026")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/destinations/BCN/sights")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void airportsArePublic() throws Exception {
        mvc.perform(get("/api/v1/airports").param("q", "bucharest")).andExpect(status().isOk()).andExpect(jsonPath("$[*].iata", hasItem("OTP")));
    }
}
