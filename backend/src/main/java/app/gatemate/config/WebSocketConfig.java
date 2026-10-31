package app.gatemate.config;

import app.gatemate.chat.ChatService;
import java.util.UUID;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final JwtDecoder jwt;
    private final ChatService chat;
    private final GatemateProperties props;

    public WebSocketConfig(JwtDecoder jwt, @Lazy ChatService chat, GatemateProperties props) {
        this.jwt = jwt;
        this.chat = chat;
        this.props = props;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry r) {
        r.addEndpoint("/ws").setAllowedOrigins(props.corsOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry r) {
        r.enableSimpleBroker("/topic");
        r.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration reg) {
        reg.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                var acc = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (acc == null) return message;
                if (StompCommand.CONNECT.equals(acc.getCommand())) {
                    String h = acc.getFirstNativeHeader("Authorization");
                    if (h == null || !h.startsWith("Bearer ")) throw new AccessDeniedException("Missing token");
                    var token = jwt.decode(h.substring(7));
                    acc.setUser(new JwtAuthenticationToken(token));
                } else if (StompCommand.SUBSCRIBE.equals(acc.getCommand())) {
                    String dest = acc.getDestination();
                    if (acc.getUser() == null || dest == null || !dest.startsWith("/topic/chats/")) throw new AccessDeniedException("Forbidden");
                    UUID thread = UUID.fromString(dest.substring("/topic/chats/".length()));
                    UUID user = UUID.fromString(acc.getUser().getName());
                    if (!chat.isMember(thread, user)) throw new AccessDeniedException("Forbidden");
                } else if (StompCommand.SEND.equals(acc.getCommand())) {
                    throw new AccessDeniedException("Use the REST API to send messages");
                }
                return message;
            }
        });
    }
}
