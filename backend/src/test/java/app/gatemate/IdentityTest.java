package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.gatemate.identity.Mrz;
import java.time.LocalDate;
import java.util.List;
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
class IdentityTest {
    @Autowired WebApplicationContext ctx;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
    }

    JsonNode post(String url, String token, String body, int status) throws Exception {
        var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(body).with(r -> {
            r.setRemoteAddr("10.1.0." + (int) (Math.random() * 250));
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

    static String passport(String last, String first, String number, LocalDate birth, LocalDate expiry) {
        String l1 = pad("P<ROU" + last.toUpperCase() + "<<" + first.toUpperCase().replace(' ', '<'), 44);
        String num = pad(number, 9);
        String b = yymmdd(birth), e = yymmdd(expiry);
        String opt = pad("", 14);
        String part = num + Mrz.digit(num) + "ROU" + b + Mrz.digit(b) + "F" + e + Mrz.digit(e) + opt + "<";
        String composite = part.substring(0, 10) + part.substring(13, 20) + part.substring(21, 43);
        return l1 + "\n" + part + Mrz.digit(composite);
    }

    static String pad(String s, int n) {
        return (s + "<".repeat(n)).substring(0, n);
    }

    static String yymmdd(LocalDate d) {
        return String.format("%02d%02d%02d", d.getYear() % 100, d.getMonthValue(), d.getDayOfMonth());
    }

    String scan(String mrz) throws Exception {
        return json.writeValueAsString(java.util.Map.of("lines", List.of(mrz.split("\n"))));
    }

    @Test
    void icaoSpecimenParses() {
        var d = Mrz.parse(List.of("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10")).orElseThrow();
        assertThat(d.lastName()).isEqualTo("Eriksson");
        assertThat(d.firstName()).isEqualTo("Anna Maria");
        assertThat(d.number()).isEqualTo("L898902C3");
        assertThat(d.country()).isEqualTo("UTO");
        assertThat(Mrz.parse(List.of("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<11"))).isEmpty();
    }

    @Test
    void nameOnTicketsChangesOnlyWithAPassport() throws Exception {
        String access = register("id+" + UUID.randomUUID() + "@example.com", "Ion Ionescu").get("accessToken").asString();
        mvc.perform(patch("/api/v1/me").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"legalFirstName\":\"Ana\",\"legalLastName\":\"Popescu\"}")).andExpect(status().isConflict());

        String expired = passport("POPESCU", "ANA", "AB123456", LocalDate.of(1990, 5, 1), LocalDate.now().minusDays(3));
        post("/api/v1/me/identity", access, scan(expired), 400);

        String good = passport("POPESCU", "ANA", "AB" + (100000 + (int) (Math.random() * 899999)), LocalDate.of(1990, 5, 1), LocalDate.now().plusYears(4));
        var me = post("/api/v1/me/identity", access, scan(good), 200);
        assertThat(me.path("legalFirstName").asString()).isEqualTo("Ana");
        assertThat(me.path("legalLastName").asString()).isEqualTo("Popescu");
        assertThat(me.path("identityVerified").asBoolean()).isTrue();

        String other = register("id2+" + UUID.randomUUID() + "@example.com", "Mara Pop").get("accessToken").asString();
        post("/api/v1/me/identity", other, scan(good), 409);
    }

    @Test
    void familyFliesOnOneBooking() throws Exception {
        String access = register("fam+" + UUID.randomUUID() + "@example.com", "Ana Popescu").get("accessToken").asString();
        var kid = post("/api/v1/me/companions", access, "{\"firstName\":\"Matei\",\"lastName\":\"Popescu\",\"relation\":\"child\"}", 200);
        var partner = post("/api/v1/me/companions", access, "{\"firstName\":\"Radu\",\"lastName\":\"Popescu\",\"relation\":\"partner\"}", 200);
        String body = "{\"carrier\":\"RO\",\"flightNumber\":\"301\",\"date\":\"" + LocalDate.now().plusDays(9) + "T08:00:00\",\"from\":\"CRA\",\"to\":\"BCN\",\"seat\":\"12A\","
                + "\"passengers\":[{\"companionId\":\"" + kid.path("id").asString() + "\",\"seat\":\"12B\"}]}";
        var trip = post("/api/v1/flights", access, body, 200);
        var flight = trip.path("flights").get(0);
        assertThat(flight.path("passengers").size()).isEqualTo(1);
        assertThat(flight.path("passengers").get(0).path("name").asString()).isEqualTo("Matei Popescu");
        assertThat(flight.path("passengers").get(0).path("seat").asString()).isEqualTo("12B");

        var updated = post("/api/v1/flights/" + flight.path("id").asString() + "/passengers", access,
                "{\"companionId\":\"" + partner.path("id").asString() + "\",\"seat\":\"12C\"}", 200);
        assertThat(updated.path("passengers").size()).isEqualTo(2);

        var verified = post("/api/v1/me/companions/" + kid.path("id").asString() + "/identity", access,
                scan(passport("POPESCU", "MATEI ANDREI", "CD" + (100000 + (int) (Math.random() * 899999)), LocalDate.of(2016, 2, 3), LocalDate.now().plusYears(2))), 200);
        assertThat(verified.path("verified").asBoolean()).isTrue();
        assertThat(verified.path("firstName").asString()).isEqualTo("Matei Andrei");

        String stranger = register("str+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        post("/api/v1/flights/" + flight.path("id").asString() + "/passengers", stranger, "{\"companionId\":\"" + kid.path("id").asString() + "\"}", 404);
    }

    @Test
    void everyoneInTheFamilyScansIntoTheSameFlight() throws Exception {
        String access = register("pass-fam+" + UUID.randomUUID() + "@example.com", "Ana Popescu").get("accessToken").asString();
        post("/api/v1/me/companions", access, "{\"firstName\":\"Matei\",\"lastName\":\"Popescu\",\"relation\":\"child\"}", 200);
        post("/api/v1/me/companions", access, "{\"firstName\":\"Ioana\",\"lastName\":\"Popescu\",\"relation\":\"child\"}", 200);
        int julian = LocalDate.now().plusDays(12).getDayOfYear();
        String pnr = "FAM" + (100 + (int) (Math.random() * 899));
        String kidPass = BcbpAndNameTest.pass("POPESCU/MATEI", pnr, "CRA", "BCN", "W6", "3105", julian, "014B");
        String kid2Pass = BcbpAndNameTest.pass("POPESCU/IOANA", pnr, "CRA", "BCN", "W6", "3105", julian, "014C");
        String myPass = BcbpAndNameTest.pass("POPESCU/ANA", pnr, "CRA", "BCN", "W6", "3105", julian, "014A");
        String claim = "{\"method\":\"pass\",\"barcode\":\"%s\"}";

        var t1 = post("/api/v1/flights/claim", access, String.format(claim, kidPass), 200);
        var f1 = t1.path("flights").get(0);
        assertThat(f1.path("ownerFlying").asBoolean()).isFalse();
        assertThat(f1.path("passengers").get(0).path("name").asString()).isEqualTo("Matei Popescu");
        assertThat(f1.path("passengers").get(0).path("barcode").asString()).isEqualTo(kidPass);

        post("/api/v1/flights/claim", access, String.format(claim, kid2Pass), 200);
        var t3 = post("/api/v1/flights/claim", access, String.format(claim, myPass), 200);
        assertThat(t3.path("flights").size()).isEqualTo(1);
        var f = t3.path("flights").get(0);
        assertThat(f.path("id").asString()).isEqualTo(f1.path("id").asString());
        assertThat(f.path("ownerFlying").asBoolean()).isTrue();
        assertThat(f.path("seat").asString()).isEqualTo("14A");
        assertThat(f.path("barcode").asString()).isEqualTo(myPass);
        assertThat(f.path("passengers").size()).isEqualTo(2);

        post("/api/v1/flights/claim", access, String.format(claim, kidPass), 409);
        String stranger = register("str2+" + UUID.randomUUID() + "@example.com", "Dan Ionescu").get("accessToken").asString();
        post("/api/v1/flights/claim", stranger, String.format(claim, kid2Pass), 403);
    }

    @Test
    void sameLastNameAndPrefixFirstNamesGoToTheRightPerson() throws Exception {
        String access = register("ion+" + UUID.randomUUID() + "@example.com", "Ion Popescu").get("accessToken").asString();
        var son = post("/api/v1/me/companions", access, "{\"firstName\":\"Ionut\",\"lastName\":\"Popescu\",\"relation\":\"child\"}", 200);
        int julian = LocalDate.now().plusDays(15).getDayOfYear();
        String pnr = "ION" + (100 + (int) (Math.random() * 899));
        String claim = "{\"method\":\"pass\",\"barcode\":\"%s\"}";
        var mine = post("/api/v1/flights/claim", access, String.format(claim, BcbpAndNameTest.pass("POPESCU/IONMR", pnr, "OTP", "LTN", "W6", "3301", julian, "021A")), 200);
        var trip = post("/api/v1/flights/claim", access, String.format(claim, BcbpAndNameTest.pass("POPESCU/IONUTMSTR", pnr, "OTP", "LTN", "W6", "3301", julian, "021B")), 200);
        var f = trip.path("flights").get(0);
        assertThat(f.path("id").asString()).isEqualTo(mine.path("flights").get(0).path("id").asString());
        assertThat(f.path("seat").asString()).isEqualTo("21A");
        assertThat(f.path("passengers").get(0).path("companionId").asString()).isEqualTo(son.path("id").asString());
        assertThat(f.path("passengers").get(0).path("seat").asString()).isEqualTo("21B");

        var friend = post("/api/v1/me/companions", access, "{\"firstName\":\"Ioana\",\"lastName\":\"Popescu\",\"relation\":\"friend\"}", 200);
        String body = json.writeValueAsString(java.util.Map.of("method", "pass", "companionId", friend.path("id").asString(),
                "barcode", BcbpAndNameTest.pass("POPESCU/IOANA", pnr, "OTP", "LTN", "W6", "3301", julian, "021C")));
        var withFriend = post("/api/v1/flights/claim", access, body, 200);
        assertThat(withFriend.path("flights").get(0).path("passengers").size()).isEqualTo(2);
    }

    @Test
    void freeAccountsKeepALimitedNumberOfTicketsFamilyIncluded() throws Exception {
        String access = register("limit+" + UUID.randomUUID() + "@example.com", "Dana Pop").get("accessToken").asString();
        var ids = new java.util.ArrayList<String>();
        for (String n : List.of("Ilie", "Rares", "Sara")) {
            ids.add(post("/api/v1/me/companions", access, "{\"firstName\":\"" + n + "\",\"lastName\":\"Pop\",\"relation\":\"child\"}", 200).path("id").asString());
        }
        String body = "{\"carrier\":\"RO\",\"flightNumber\":\"401\",\"date\":\"" + LocalDate.now().plusDays(20) + "T08:00:00\",\"from\":\"OTP\",\"to\":\"LHR\","
                + "\"passengers\":[{\"companionId\":\"" + ids.get(0) + "\"},{\"companionId\":\"" + ids.get(1) + "\"}]}";
        var trip = post("/api/v1/flights", access, body, 200);
        String flight = trip.path("flights").get(0).path("id").asString();
        var res = post("/api/v1/flights/" + flight + "/passengers", access, "{\"companionId\":\"" + ids.get(2) + "\"}", 402);
        assertThat(res.path("code").asString()).isEqualTo("pro_required");
    }

    @Test
    void inviteSomeoneToATripByEmail() throws Exception {
        String access = register("inv+" + UUID.randomUUID() + "@example.com", "Ana Popescu").get("accessToken").asString();
        var trip = post("/api/v1/flights", access, "{\"carrier\":\"RO\",\"flightNumber\":\"301\",\"date\":\"" + LocalDate.now().plusDays(8) + "T08:00:00\",\"from\":\"CRA\",\"to\":\"BCN\"}", 200);
        var res = post("/api/v1/invites/email", access, "{\"targetId\":\"" + trip.path("id").asString() + "\",\"email\":\"friend@example.com\"}", 200);
        assertThat(res.path("url").asString()).contains("/invite/");
        assertThat(res.path("sent").asBoolean()).isFalse();
        post("/api/v1/invites/email", access, "{\"targetId\":\"" + trip.path("id").asString() + "\",\"email\":\"not-an-email\"}", 400);
        String stranger = register("inv2+" + UUID.randomUUID() + "@example.com").get("accessToken").asString();
        post("/api/v1/invites/email", stranger, "{\"targetId\":\"" + trip.path("id").asString() + "\",\"email\":\"x@example.com\"}", 404);
    }
}
