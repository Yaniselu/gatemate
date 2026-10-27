package app.gatemate.trip;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "checklist_items")
public class ChecklistItemEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID tripId;
    public String label;
    public boolean done;
    public String category;
    public int position;
}
