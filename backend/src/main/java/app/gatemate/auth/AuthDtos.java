package app.gatemate.auth;

import app.gatemate.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record Session(UserDto user, String accessToken, long expiresAt, String refreshToken) {}

    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {}

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 60) @Pattern(regexp = "^[\\p{L}][\\p{L}\\p{M}' .-]{1,59}$") String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 10, max = 128) String password) {}

    public record SocialRequest(
            @NotBlank @Size(max = 8192) String idToken,
            @NotBlank @Size(max = 256) String nonce,
            @Size(max = 60) String displayName,
            @Size(max = 2048) String authorizationCode) {}

    public record RefreshRequest(@NotBlank @Size(max = 200) String refreshToken) {}

    public record ResetRequest(@NotBlank @Email @Size(max = 254) String email) {}

    public record ResetConfirm(@NotBlank @Size(max = 200) String token, @NotBlank @Size(min = 10, max = 128) String password) {}
}
