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
        String[] parts = access.split("\\.");
        String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1])).replaceFirst("\"sub\":\"[^\"]+\"", "\"sub\":\"" + UUID.randomUUID() + "\"");
        String forged = parts[0] + "." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes()) + "." + parts[2];
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
        String none = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes()) + "." + parts[1] + ".";
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + none)).andExpect(status().isUnauthorized());

        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"wrong-password\"}", 401);
        post("/api/v1/auth/login", null, "{\"email\":\"" + email + "\",\"password\":\"Correct-Horse-42!\"}", 200);

        String rt2 = post("/api/v1/auth/refresh", null, "{\"refreshToken\":\"" + rt1 + "\"}", 200).get("refreshToken").asString();
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
        String access = register("pass+" + UUID.randomUUID() + "@example.com", "Ion").get("accessToken").asString();
        int julian = LocalDate.now().plusDays(10).getDayOfYear();
        String barcode = BcbpAndNameTest.pass("POPESCU/ANA", "QWE" + (int) (Math.random() * 900 + 100), "OTP", "LTN", "W6", "3301", julian, "012A");
        String claim = "{\"method\":\"pass\",\"barcode\":\"" + barcode + "\"}";

        post("/api/v1/flights/claim", access, claim, 422);

        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ion\",\"legalLastName\":\"Ionescu\"}")).andExpect(status().isOk());
        post("/api/v1/flights/claim", access, claim, 403);

        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isConflict());
        post("/api/v1/flights/claim", access, claim, 403);
        String mrz = IdentityTest.passport("POPESCU", "ANA", "PX" + (100000 + (int) (Math.random() * 899999)), LocalDate.of(1991, 7, 9), LocalDate.now().plusYears(3));
        post("/api/v1/me/identity", access, json.writeValueAsString(java.util.Map.of("lines", java.util.List.of(mrz.split("\n")))), 200);
        var trip = post("/api/v1/flights/claim", access, claim, 200);
        org.junit.jupiter.api.Assertions.assertEquals("verified", trip.path("flights").get(0).path("verification").path("status").asString());

        post("/api/v1/flights/claim", access, claim, 409);
        String other = register("other+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isOk());
        post("/api/v1/flights/claim", other, claim, 409);

        mvc.perform(get("/api/v1/trips").header("Authorization", "Bearer " + access)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].destination.code").value("LTN"));
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
        post("/api/v1/chats/" + chatId + "/messages", access, "{\"text\":\"Hello team\",\"clientId\":\"c-1\"}", 200);
        mvc.perform(get("/api/v1/chats/" + chatId + "/messages").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$", hasSize(1)));

        String outsider = register("out+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(get("/api/v1/chats/" + chatId + "/messages").header("Authorization", "Bearer " + outsider)).andExpect(status().isNotFound());

        String tripId = trip.path("id").asString();
        post("/api/v1/trips/" + tripId + "/checklist", access, "{\"label\":\"Plug adapter\",\"category\":\"packing\"}", 200);
        post("/api/v1/trips/" + tripId + "/checklist", register("x+" + UUID.randomUUID() + "@example.com").get("accessToken").asString(),
                "{\"label\":\"Nope\",\"category\":\"packing\"}", 404);

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
    void proSubscriptionLiftsTheFreeTripLimit() throws Exception {
        var s = register("pro+" + UUID.randomUUID() + "@example.com");
        String access = s.get("accessToken").asString();
        String userId = s.path("user").path("id").asString();
        String[] to = {"LTN", "CDG", "FCO", "BCN"};
        for (int i = 0; i < 3; i++) {
            post("/api/v1/flights", access, "{\"carrier\":\"W6\",\"flightNumber\":\"33" + i + "\",\"from\":\"OTP\",\"to\":\"" + to[i] + "\",\"date\":\""
                    + LocalDate.now().plusDays(5 + i) + "T06:00\"}", 200);
        }
        String fourth = "{\"carrier\":\"W6\",\"flightNumber\":\"339\",\"from\":\"OTP\",\"to\":\"BCN\",\"date\":\"" + LocalDate.now().plusDays(9) + "T06:00\"}";
        var blocked = post("/api/v1/flights", access, fourth, 402);
        org.junit.jupiter.api.Assertions.assertEquals("pro_required", blocked.path("code").asString());

        long exp = System.currentTimeMillis() + 30L * 86_400_000;
        String event = "{\"event\":{\"id\":\"evt-" + UUID.randomUUID() + "\",\"type\":\"INITIAL_PURCHASE\",\"app_user_id\":\"" + userId
                + "\",\"product_id\":\"gatemate_pro_monthly\",\"expiration_at_ms\":" + exp + "}}";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/billing/revenuecat")
                .header("Authorization", "Bearer nope").contentType(MediaType.APPLICATION_JSON).content(event)).andExpect(status().isUnauthorized());
        for (int i = 0; i < 2; i++) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/billing/revenuecat")
                    .header("Authorization", "Bearer test-webhook-secret").contentType(MediaType.APPLICATION_JSON).content(event)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$.pro").value(true));
        post("/api/v1/flights", access, fourth, 200);

        String expire = "{\"event\":{\"id\":\"evt-" + UUID.randomUUID() + "\",\"type\":\"EXPIRATION\",\"app_user_id\":\"" + userId + "\",\"expiration_at_ms\":"
                + (System.currentTimeMillis() - 1000) + "}}";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/billing/revenuecat")
                .header("Authorization", "Bearer test-webhook-secret").contentType(MediaType.APPLICATION_JSON).content(expire)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$.pro").value(false));
    }

    @Test
    void airportsArePublic() throws Exception {
        mvc.perform(get("/api/v1/airports").param("q", "bucharest")).andExpect(status().isOk()).andExpect(jsonPath("$[*].iata", hasItem("OTP")));
    }

    static String emailText(LocalDate day) {
        var d = day.format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH));
        return "Your booking is confirmed!\nBooking reference: K7Q2MX\nPassenger: MS ANA POPESCU\n\n"
                + "Outbound flight W6 3121\n" + d + "\nBucharest (OTP) 06:10 → London Luton (LTN) 07:55\nSeat 12A\n\nTotal paid 129.99 EUR";
    }

    @Test
    void pastedConfirmationEmailCreatesAVerifiedNameTrip() throws Exception {
        String access = register("mail+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isOk());
        String body = json.writeValueAsString(java.util.Map.of("text", emailText(LocalDate.now().plusDays(20))));
        var preview = post("/api/v1/bookings/email/preview", access, body, 200);
        org.junit.jupiter.api.Assertions.assertEquals(1, preview.path("flights").size());
        var f = preview.path("flights").get(0);
        org.junit.jupiter.api.Assertions.assertEquals("W6 3121", f.path("number").asString());
        org.junit.jupiter.api.Assertions.assertEquals("Wizz Air", f.path("airline").asString());
        org.junit.jupiter.api.Assertions.assertEquals("OTP", f.path("from").path("code").asString());
        org.junit.jupiter.api.Assertions.assertEquals("LTN", f.path("to").path("code").asString());
        org.junit.jupiter.api.Assertions.assertEquals("12A", f.path("seat").asString());
        org.junit.jupiter.api.Assertions.assertEquals("K7Q2MX", preview.path("bookingRef").asString());
        org.junit.jupiter.api.Assertions.assertTrue(preview.path("nameFound").asBoolean());
        var dep = java.time.Instant.parse(f.path("departure").asString()).atZone(java.time.ZoneId.of("Europe/Bucharest"));
        org.junit.jupiter.api.Assertions.assertEquals(java.time.LocalTime.of(6, 10), dep.toLocalTime());

        var trip = post("/api/v1/bookings/email/import", access, body, 200);
        org.junit.jupiter.api.Assertions.assertEquals("pending", trip.path("flights").get(0).path("verification").path("status").asString());
        org.junit.jupiter.api.Assertions.assertEquals("email", trip.path("flights").get(0).path("verification").path("method").asString());
        post("/api/v1/bookings/email/import", access, body, 409);
        post("/api/v1/bookings/email/preview", access, "{\"text\":\"Thanks for shopping with us\"}", 422);
    }

    @Test
    void forwardedEmailNeedsTheOwnersAuthenticatedAddress() throws Exception {
        String email = "fwd+" + UUID.randomUUID() + "@example.com";
        String access = register(email).get("accessToken").asString();
        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isOk());
        String address = mvc.perform(get("/api/v1/me/import-email").header("Authorization", "Bearer " + access)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertTrue(address.contains("@cloudmailin.net"), address);
        String to = address.replaceAll(".*?([a-z0-9]+\\+[a-z0-9]+@cloudmailin\\.net).*", "$1");
        String text = emailText(LocalDate.now().plusDays(30));

        java.util.function.BiFunction<String, String, String> postmark = (from, spf) -> json.writeValueAsString(java.util.Map.of(
                "FromFull", java.util.Map.of("Email", from), "ToFull", java.util.List.of(java.util.Map.of("Email", to)), "TextBody", text,
                "Headers", java.util.List.of(java.util.Map.of("Name", "Received-SPF", "Value", spf))));
        String basic = "Basic " + java.util.Base64.getEncoder().encodeToString("gatemate:test-inbound-secret".getBytes());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/inbound/email").contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Basic " + java.util.Base64.getEncoder().encodeToString("x:nope".getBytes())).content(postmark.apply(email, "Pass"))).andExpect(status().isUnauthorized());
        for (String bad : java.util.List.of(postmark.apply("stranger@example.com", "Pass"), postmark.apply(email, "Fail"))) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/inbound/email").contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", basic).content(bad)).andExpect(status().isAccepted());
        }
        mvc.perform(get("/api/v1/trips").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/inbound/email").contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", basic).content(postmark.apply(email, "Pass (sender SPF authorized)"))).andExpect(status().isAccepted());
        mvc.perform(get("/api/v1/trips").header("Authorization", "Bearer " + access)).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].flights[0].verification.status").value("verified"));
    }

    @Test
    void groupLinkedToATripIncludesItsTravellers() throws Exception {
        String access = register("grp+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        var trip = post("/api/v1/flights", access, "{\"carrier\":\"RO\",\"flightNumber\":\"301\",\"from\":\"OTP\",\"to\":\"CDG\",\"date\":\""
                + LocalDate.now().plusDays(5) + "T10:30:00\"}", 200);
        var g = post("/api/v1/chats", access, "{\"title\":\"Paris squad\",\"emoji\":\"🏖️\",\"tripId\":\"" + trip.path("id").asString() + "\"}", 200);
        org.junit.jupiter.api.Assertions.assertEquals("Paris squad", g.path("title").asString());
        post("/api/v1/chats", access, "{\"title\":\"No trip\",\"emoji\":\"✈️\"}", 200);
        String other = register("grp2+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        post("/api/v1/chats", other, "{\"title\":\"Sneaky\",\"emoji\":\"✈️\",\"tripId\":\"" + trip.path("id").asString() + "\"}", 404);
    }
}
