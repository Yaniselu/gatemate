package app.gatemate.auth;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.config.GatemateProperties;
import app.gatemate.user.UserDto;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TokenService {
    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private final JwtEncoder encoder;
    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final GatemateProperties props;

    public TokenService(JwtEncoder encoder, RefreshTokenRepository tokens, UserRepository users, GatemateProperties props) {
        this.encoder = encoder;
        this.tokens = tokens;
        this.users = users;
        this.props = props;
    }

    @Transactional
    public AuthDtos.Session issue(UserEntity user) {
        return issue(user, UUID.randomUUID());
    }

    private AuthDtos.Session issue(UserEntity user, UUID family) {
        Instant now = Instant.now();
        Instant exp = now.plus(props.jwt().accessTtl());
        var claims = JwtClaimsSet.builder()
                .issuer(props.jwt().issuer())
                .subject(user.id.toString())
                .issuedAt(now)
                .expiresAt(exp)
                .claim("roles", List.of(user.role))
                .build();
        String access = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).keyId("gm-1").build(), claims)).getTokenValue();

        String refresh = "rt_" + Crypto.token(32);
        var rt = new RefreshTokenEntity();
        rt.userId = user.id;
        rt.familyId = family;
        rt.tokenHash = Crypto.sha256(refresh);
        rt.expiresAt = now.plus(props.jwt().refreshTtl());
        tokens.save(rt);
        return new AuthDtos.Session(UserDto.of(user), access, exp.toEpochMilli(), refresh);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthDtos.Session rotate(String refreshToken) {
        var rt = tokens.findByTokenHash(Crypto.sha256(refreshToken)).orElseThrow(TokenService::invalid);
        Instant now = Instant.now();
        if (rt.revokedAt != null) {
            log.warn("Refresh token reuse detected for user {} — revoking token family", rt.userId);
            tokens.revokeFamily(rt.familyId, now);
            throw invalid();
        }
        if (rt.expiresAt.isBefore(now)) throw invalid();
        var user = users.findById(rt.userId).orElseThrow(TokenService::invalid);
        if (user.banned) throw invalid();
        rt.revokedAt = now;
        tokens.save(rt);
        return issue(user, rt.familyId);
    }

    @Transactional
    public void revokeAll(UUID userId) {
        tokens.revokeAllForUser(userId, Instant.now());
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "invalid_grant", "Your session has expired. Please sign in again.");
    }
}
