package app.gatemate.identity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "companions")
public class CompanionEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID ownerId;
    public String firstName;
    public String lastName;
    public String relation;
    public Instant verifiedAt;
    public String docCountry;
    public LocalDate docExpiry;
    public String docHash;
    public Instant createdAt = Instant.now();

    public String fullName() {
        return (firstName + " " + lastName).trim();
    }

    public interface Repo extends JpaRepository<CompanionEntity, UUID> {
        List<CompanionEntity> findByOwnerIdOrderByCreatedAt(UUID ownerId);
    }
}
