package app.gatemate.chat;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class ChatEntities {
    private ChatEntities() {}

    @Entity
    @Table(name = "chat_threads")
    public static class Thread {
        @Id public UUID id = UUID.randomUUID();
        public String title;
        public String emoji;
        public UUID tripId;
        public boolean isPublic;
        public String loungeKey;
        public UUID createdBy;
        public Instant createdAt = Instant.now();
    }

    @Entity
    @Table(name = "chat_members")
    @IdClass(MemberKey.class)
    public static class Member {
        @Id public UUID threadId;
        @Id public UUID userId;
        public boolean muted;
        public Instant lastReadAt;
    }

    public static class MemberKey implements Serializable {
        public UUID threadId;
        public UUID userId;

        public MemberKey() {}

        public MemberKey(UUID threadId, UUID userId) {
            this.threadId = threadId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof MemberKey k && Objects.equals(threadId, k.threadId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(threadId, userId);
        }
    }

    @Entity
    @Table(name = "chat_messages")
    public static class Message {
        @Id public UUID id = UUID.randomUUID();
        public UUID threadId;
        public UUID authorId;
        public String text;
        public String clientId;
        public boolean flagged;
        public boolean hidden;
        public int reportCount;
        public Instant createdAt = Instant.now();
    }
}
