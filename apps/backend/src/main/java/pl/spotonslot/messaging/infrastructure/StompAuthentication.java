package pl.spotonslot.messaging.infrastructure;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.stereotype.Component;

/**
 * Signs a STOMP session in with the access token of its {@code CONNECT} frame ({@code Authorization: Bearer ...});
 * without a valid one the connection is refused. Clients only subscribe to their own queue
 * ({@code /user/queue/...}) and send nothing: messages go through REST.
 */
@Component
@RequiredArgsConstructor
class StompAuthentication implements ChannelInterceptor {

    private static final String BEARER = "Bearer ";

    private final JwtDecoder decoder;
    private final JwtAuthenticationConverter converter;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        var accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        var command = accessor.getCommand();
        if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
            var header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith(BEARER)) {
                throw new AccessDeniedException("An access token is required");
            }
            try {
                accessor.setUser(converter.convert(decoder.decode(header.substring(BEARER.length()))));
            } catch (JwtException e) {
                throw new AccessDeniedException("Invalid access token");
            }
        } else if (command == StompCommand.SUBSCRIBE) {
            var destination = accessor.getDestination();
            if (accessor.getUser() == null || destination == null || !destination.startsWith("/user/queue/")) {
                throw new AccessDeniedException("Only the own queue can be subscribed to");
            }
        } else if (command == StompCommand.SEND) {
            throw new AccessDeniedException("Messages are sent over REST");
        }
        return message;
    }
}
