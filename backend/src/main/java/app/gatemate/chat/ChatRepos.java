package app.gatemate.chat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public final class ChatRepos {
    private ChatRepos() {}

    public interface Threads extends JpaRepository<ChatEntities.Thread, UUID> {
        @Query("select t from ChatEntities$Thread t where t.id in (select m.threadId from ChatEntities$Member m where m.userId = :user)")
        List<ChatEntities.Thread> findForMember(UUID user);

        Optional<ChatEntities.Thread> findByLoungeKey(String key);
    }

    public interface Members extends JpaRepository<ChatEntities.Member, ChatEntities.MemberKey> {
        List<ChatEntities.Member> findByThreadId(UUID threadId);
        Optional<ChatEntities.Member> findByThreadIdAndUserId(UUID threadId, UUID userId);
        boolean existsByThreadIdAndUserId(UUID threadId, UUID userId);
    }

    public interface Messages extends JpaRepository<ChatEntities.Message, UUID> {
        @Query("select m from ChatEntities$Message m where m.threadId = :thread and m.hidden = false order by m.createdAt desc")
        List<ChatEntities.Message> latest(UUID thread, Pageable page);

        Optional<ChatEntities.Message> findByAuthorIdAndClientId(UUID author, String clientId);

        @Query("select count(m) from ChatEntities$Message m where m.threadId = :thread and m.hidden = false and m.authorId <> :user and m.createdAt > :since")
        long countUnread(UUID thread, UUID user, Instant since);

        @Query("select count(m) from ChatEntities$Message m where m.authorId = :author and m.createdAt > :since")
        long countSince(UUID author, Instant since);
    }
}
