package app.gatemate.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ProofOfWorkTest {
    private static String solve(String token, int bits) {
        for (long n = 0; ; n++) if (ProofOfWork.leadingZeroBits(ProofOfWork.sha256(token + ":" + n)) >= bits) return token + ":" + n;
    }

    @Test
    void acceptsASolvedChallengeOnlyOnce() {
        var pow = new ProofOfWork(12);
        String token = (String) pow.challenge().get("token");
        String proof = solve(token, 12);
        assertThat(pow.verify(proof)).isTrue();
        assertThat(pow.verify(proof)).isFalse();
    }

    @Test
    void rejectsBadProofs() {
        var pow = new ProofOfWork(12);
        String token = (String) pow.challenge().get("token");
        String proof = solve(token, 12);
        String nonce = proof.substring(proof.lastIndexOf(':') + 1);
        assertThat(pow.verify(null)).isFalse();
        assertThat(pow.verify("")).isFalse();
        long wrong = Long.parseLong(nonce) + 1;
        while (ProofOfWork.leadingZeroBits(ProofOfWork.sha256(token + ":" + wrong)) >= 12) wrong++;
        assertThat(pow.verify(token + ":" + wrong)).isFalse();
        String forged = token.substring(0, token.indexOf('.')) + ".AAAA";
        assertThat(pow.verify(forged + ":" + nonce)).isFalse();
        var other = new ProofOfWork(12);
        assertThat(other.verify(proof)).isFalse();
        assertThat(pow.verify(token + ":abc")).isFalse();
    }

    @Test
    void disabledWhenZeroBits() {
        assertThat(new ProofOfWork(0).verify(null)).isTrue();
    }

    @Test
    void clientIpIgnoresSpoofedForwardedEntries() {
        var req = new MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.1");
        req.addHeader("X-Forwarded-For", "1.2.3.4, 203.0.113.9");
        assertThat(RateLimitFilter.clientIp(req)).isEqualTo("203.0.113.9");
        var plain = new MockHttpServletRequest();
        plain.setRemoteAddr("198.51.100.7");
        assertThat(RateLimitFilter.clientIp(plain)).isEqualTo("198.51.100.7");
    }
}
