package app.gatemate.trip;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "expenses")
public class ExpenseEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID tripId;
    public String label;
    public long amountCents;
    public String currency;
    public UUID paidBy;
    /** Comma-separated user ids. */
    public String splitWith;
    public Instant createdAt = Instant.now();
}
