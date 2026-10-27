package app.gatemate.feedback;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "feedback")
public class FeedbackEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID userId;
    public String topic;
    public String message;
    public Integer rating;
    public String contactEmail;
    public Instant createdAt = Instant.now();

    public interface Repo extends JpaRepository<FeedbackEntity, UUID> {}
}
