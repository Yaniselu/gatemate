package app.gatemate.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class TripDtos {
    private TripDtos() {}

    public record AirportDto(String code, String city, String name, String country, String timezone, String imageUrl) {}

    public record FlightDto(String id, String airline, String airlineCode, String number, AirportDto from, AirportDto to, String departure,
            String arrival, String boardingTime, String gate, String terminal, String seat, String cabin, String bookingRef, String passengerName,
            String status, int durationMinutes, int distanceKm, String fareName, JsonNode baggage, JsonNode verification,
            String scheduledDeparture, String scheduledArrival, int delayMinutes, List<PassengerDto> passengers) {}

    public record PassengerDto(String companionId, String name, String seat, String relation, boolean verified) {}

    public record PassengerIn(@NotBlank String companionId, @Pattern(regexp = "\\d{1,3}[A-K]") String seat) {}

    public record Traveller(String id, String name, String initials, String color) {}

    public record ChecklistDto(String id, String label, boolean done, String category) {}

    public record ExpenseDto(String id, String label, double amount, String currency, String paidBy, List<String> splitWith, String createdAt) {}

    public record TripDto(String id, String title, AirportDto destination, String coverGradient, String emoji, String startDate, String endDate,
            List<FlightDto> flights, List<Traveller> travellers, List<ChecklistDto> checklist, List<ExpenseDto> expenses, String chatId) {}

    public record NewFlight(
            @NotBlank @Pattern(regexp = "[A-Z0-9]{2,3}") String carrier,
            @Size(max = 40) String airlineName,
            @NotBlank @Pattern(regexp = "\\d{1,4}[A-Z]?") String flightNumber,
            @NotBlank String date,
            @NotBlank @Pattern(regexp = "[A-Z]{3}") String from,
            @NotBlank @Pattern(regexp = "[A-Z]{3}") String to,
            @Pattern(regexp = "\\d{1,3}[A-K]") String seat,
            @Pattern(regexp = "[A-Z0-9]{5,8}") String bookingRef,
            @Size(max = 60) String passengerName,
            @Size(max = 12) List<@Valid PassengerIn> passengers) {}

    public record NewChecklistItem(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 80) String label,
            @jakarta.validation.constraints.Pattern(regexp = "documents|packing|tasks") String category) {}

    public record ChecklistPatch(boolean done) {}

    public record NewExpense(
            @NotBlank @Size(max = 60) String label,
            @Positive @Max(100000) double amount,
            @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
            @NotBlank String paidBy,
            @NotEmpty @Size(max = 20) List<String> splitWith) {}
}
