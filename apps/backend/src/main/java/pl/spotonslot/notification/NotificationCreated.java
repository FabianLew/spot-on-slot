package pl.spotonslot.notification;

import java.util.UUID;

/**
 * A notification was stored for a user. The single fan-out point for delivery channels: e-mail now, WebSocket and
 * push later; can be externalized to a broker (spring-modulith-events-amqp) once the backend runs several instances.
 */
public record NotificationCreated(UUID notificationId, UUID recipientId, NotificationType type) {
}
