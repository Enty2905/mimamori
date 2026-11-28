package com.mimamori.notification.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.*;
import com.google.firebase.messaging.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FirebasePushGateway implements PushGateway {
    private final boolean enabled;
    private FirebaseMessaging messaging;
    public FirebasePushGateway(@Value("${mimamori.push.enabled:false}") boolean enabled) { this.enabled = enabled; }
    private synchronized FirebaseMessaging client() throws java.io.IOException {
        if (messaging == null) {
            FirebaseApp app = FirebaseApp.getApps().stream().filter(item -> item.getName().equals("mimamori-push")).findFirst().orElse(null);
            if (app == null) app = FirebaseApp.initializeApp(FirebaseOptions.builder().setCredentials(GoogleCredentials.getApplicationDefault()).setConnectTimeout(3000).setReadTimeout(8000).build(), "mimamori-push");
            messaging = FirebaseMessaging.getInstance(app);
        }
        return messaging;
    }
    @Override public Result send(String token, String language, Map<String,String> routing) {
        if (!enabled) return Result.UNAVAILABLE;
        try {
            String key = routing.get("notificationId");
            var message = Message.builder().setToken(token).putAllData(routing)
                    .setAndroidConfig(AndroidConfig.builder().setPriority(AndroidConfig.Priority.HIGH).setTtl(3600000).setCollapseKey(key).build())
                    .setApnsConfig(ApnsConfig.builder().putHeader("apns-collapse-id",key).setAps(Aps.builder().setContentAvailable(true).build()).build());
            // Medication is data-only: the client coalesces it with the local occurrence ID.
            if (!"REMINDER".equals(routing.get("type"))) {
                message.setNotification(com.google.firebase.messaging.Notification.builder().setTitle("Mimamori")
                        .setBody("ja".equals(language) ? "アプリでお知らせを確認してください。" : "Mở ứng dụng để xem thông báo chăm sóc.").build());
            }
            client().send(message.build());
            return Result.ACCEPTED;
        } catch (FirebaseMessagingException error) {
            if (error.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) return Result.INVALID_TOKEN;
            if (error.getMessagingErrorCode() == MessagingErrorCode.QUOTA_EXCEEDED || error.getMessagingErrorCode() == MessagingErrorCode.UNAVAILABLE || error.getMessagingErrorCode() == MessagingErrorCode.INTERNAL) return Result.RETRY;
            return Result.FAILED;
        } catch (Exception error) { return Result.UNAVAILABLE; }
    }
}
