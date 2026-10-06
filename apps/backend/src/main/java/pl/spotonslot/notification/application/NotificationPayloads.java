package pl.spotonslot.notification.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.domain.Notification;

/** Notification payloads to and from their JSON column. */
@Component
@RequiredArgsConstructor
class NotificationPayloads {

    private final ObjectMapper objectMapper;

    String write(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot write a notification payload", e);
        }
    }

    NearbyListingAlert nearbyListing(Notification notification) {
        try {
            return objectMapper.readValue(notification.getPayload(), NearbyListingAlert.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot read the payload of notification " + notification.getId(), e);
        }
    }
}
