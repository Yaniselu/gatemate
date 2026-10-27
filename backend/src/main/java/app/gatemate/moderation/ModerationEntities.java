package app.gatemate.moderation;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public final class ModerationEntities {
    private ModerationEntities() {}

    @Entity
    @Table(name = "blocks")
    @IdClass(BlockKey.class)
    public static class Block {
        @Id public UUID blockerId;
        @Id public UUID blockedId;
        public Instant createdAt = Instant.now();
    }

    public static class BlockKey implements Serializable {
        public UUID blockerId;
        public UUID blockedId;

        public BlockKey() {}

        @Override
        public boolean equals(Object o) {
            return o instanceof BlockKey k && Objects.equals(blockerId, k.blockerId) && Objects.equals(blockedId, k.blockedId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(blockerId, blockedId);
        }
    }

    @Entity
    @Table(name = "reports")
    public static class Report {
        @Id public UUID id = UUID.randomUUID();
        public UUID reporterId;
        public UUID messageId;
        public String reason;
        public String status = "OPEN";
        public Instant createdAt = Instant.now();
        public Instant resolvedAt;
        public UUID resolvedBy;
    }

    public interface Blocks extends JpaRepository<Block, BlockKey> {
        List<Block> findByBlockerId(UUID blocker);
        boolean existsByBlockerIdAndBlockedId(UUID blocker, UUID blocked);
    }

    public interface Reports extends JpaRepository<Report, UUID> {
        boolean existsByReporterIdAndMessageId(UUID reporter, UUID message);
        List<Report> findByStatusOrderByCreatedAt(String status);
    }
}
