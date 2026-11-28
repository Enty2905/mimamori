package com.mimamori.notification.service;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.HashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Database outbox is authoritative; provider outages never block care APIs. */
@Service
public class PushDispatcher {
    private final JdbcTemplate jdbc;
    private final PushGateway gateway;
    private final RedisOutboxQueue queue;
    public PushDispatcher(JdbcTemplate jdbc, PushGateway gateway,RedisOutboxQueue queue) { this.jdbc = jdbc; this.gateway = gateway;this.queue=queue; }
    @Scheduled(fixedDelay = 10000, initialDelay = 15000)
    @Transactional
    public void dispatch() {
        queue.drainHints();
        var pending = jdbc.queryForList("SELECT n.*,u.language_preference FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.created_at>? AND n.push_status<>'COMPLETE' AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=CURRENT_TIMESTAMP(6)) AND EXISTS (SELECT 1 FROM device_registrations d WHERE d.user_id=n.user_id) ORDER BY n.id LIMIT 10 FOR UPDATE SKIP LOCKED", Timestamp.from(Instant.now().minusSeconds(86400)));
        for (var notification : pending) {
            Long id = ((Number)notification.get("id")).longValue();
            Long userId = ((Number)notification.get("user_id")).longValue();
            var routing = new HashMap<String,String>();
            routing.put("notificationId",id.toString()); routing.put("ownerId",userId.toString()); routing.put("type",notification.get("type").toString());
            if (notification.get("reference_id") != null) {
                String reference = notification.get("reference_id").toString();
                if ("REMINDER".equals(notification.get("type"))) {
                    var doses = jdbc.queryForList("SELECT occurrence_id,canceled,status FROM medication_logs WHERE id=?", notification.get("reference_id"));
                    if (doses.isEmpty() || Boolean.TRUE.equals(doses.getFirst().get("canceled")) || !"PENDING".equals(doses.getFirst().get("status"))) {
                        jdbc.update("UPDATE notifications SET push_status='COMPLETE' WHERE id=?",id); continue;
                    }
                    routing.put("doseId",reference); routing.put("occurrenceId",doses.getFirst().get("occurrence_id").toString());
                } else routing.put("alertId",reference);
            }
            var devices = jdbc.queryForList("SELECT device_id,token FROM device_registrations WHERE user_id=?",userId);
            boolean complete = !devices.isEmpty();
            for (var device : devices) {
                String deviceId = device.get("device_id").toString();
                jdbc.update("INSERT IGNORE INTO notification_deliveries(notification_id,device_id) VALUES (?,?)",id,deviceId);
                var delivery = jdbc.queryForMap("SELECT status,attempts,next_attempt_at FROM notification_deliveries WHERE notification_id=? AND device_id=?",id,deviceId);
                int attempts = ((Number)delivery.get("attempts")).intValue();
                if ("ACCEPTED".equals(delivery.get("status")) || "FAILED".equals(delivery.get("status")) || "LOCAL_SCHEDULED".equals(delivery.get("status"))) continue;
                if (routing.containsKey("occurrenceId") && jdbc.queryForObject("SELECT COUNT(*) FROM local_notification_mirrors WHERE device_id=? AND occurrence_id=? AND owner_id=? AND expires_at>CURRENT_TIMESTAMP(6)",Integer.class,deviceId,routing.get("occurrenceId"),userId)>0) {
                    jdbc.update("UPDATE notification_deliveries SET status='LOCAL_SCHEDULED' WHERE notification_id=? AND device_id=?",id,deviceId);continue;
                }
                complete = false;
                if (delivery.get("next_attempt_at") instanceof Timestamp next && next.toInstant().isAfter(Instant.now())) continue;
                var result = gateway.send(device.get("token").toString(),notification.get("language_preference").toString(),routing);
                if (result == PushGateway.Result.UNAVAILABLE) {
                    jdbc.update("UPDATE notification_deliveries SET next_attempt_at=? WHERE notification_id=? AND device_id=?",Timestamp.from(Instant.now().plusSeconds(60)),id,deviceId);
                    continue;
                }
                if (result == PushGateway.Result.INVALID_TOKEN) { jdbc.update("DELETE FROM device_registrations WHERE device_id=?",deviceId); continue; }
                String status = result == PushGateway.Result.ACCEPTED ? "ACCEPTED" : result == PushGateway.Result.FAILED || attempts >= 4 ? "FAILED" : "RETRY";
                jdbc.update("UPDATE notification_deliveries SET status=?,attempts=attempts+1,next_attempt_at=? WHERE notification_id=? AND device_id=?",status,Timestamp.from(Instant.now().plusSeconds(Math.min(300, 10L << attempts))),id,deviceId);
            }
            if (complete) jdbc.update("UPDATE notifications SET push_status='COMPLETE' WHERE id=?",id);
            else jdbc.update("UPDATE notifications SET next_attempt_at=? WHERE id=?", Timestamp.from(Instant.now().plusSeconds(10)),id);
            queue.cacheStatus(id,complete?"COMPLETE":"PENDING");
        }
    }
}
