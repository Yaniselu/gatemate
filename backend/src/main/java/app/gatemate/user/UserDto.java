package app.gatemate.user;

import java.util.UUID;

public record UserDto(
        UUID id, String name, String email, String avatarColor, String avatarUrl, String provider, String homeAirport,
        String legalFirstName, String legalLastName, String phone, String seatPreference, String bio, String createdAt,
        boolean pro, String proUntil, boolean emailVerified, String lang, boolean identityVerified, String identityCountry, String identityExpiry, String country) {
    public static UserDto of(UserEntity u) {
        return new UserDto(u.id, u.displayName, u.email, u.avatarColor, u.avatarUrl, u.provider, u.homeAirport, u.legalFirstName,
                u.legalLastName, u.phone, u.seatPreference, u.bio, u.createdAt.toString(),
                u.isPro(), u.proUntil == null ? null : u.proUntil.toString(), u.emailVerified, u.lang, u.identityVerifiedAt != null, u.identityCountry,
                u.identityExpiry == null ? null : u.identityExpiry.toString(), u.country);
    }
}
