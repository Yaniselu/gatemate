package app.gatemate.user;

import java.util.UUID;

/** Mirrors the app's {@code User} model. Never contains secrets or internal flags. */
public record UserDto(
        UUID id, String name, String email, String avatarColor, String avatarUrl, String provider, String homeAirport,
        String legalFirstName, String legalLastName, String phone, String seatPreference, String bio, String createdAt,
        boolean pro, String proUntil) {

    public static UserDto of(UserEntity u) {
        return new UserDto(u.id, u.displayName, u.email, u.avatarColor, u.avatarUrl, u.provider, u.homeAirport, u.legalFirstName,
                u.legalLastName, u.phone, u.seatPreference, u.bio, u.createdAt.toString(),
                u.isPro(), u.proUntil == null ? null : u.proUntil.toString());
    }
}
