package com.mimamori.notification.service;

import com.mimamori.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeviceService {
    private final JdbcTemplate jdbc;
    public DeviceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Transactional
    public void register(Long userId, String deviceId, String token, String platform) {
        if (deviceId == null || !deviceId.matches("[A-Za-z0-9-]{16,64}") || token == null || token.length() < 20 || token.length() > 2048
                || !("android".equals(platform) || "ios".equals(platform))) throw new ApiException(400, "Invalid device registration");
        try {
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
            jdbc.update("DELETE FROM device_registrations WHERE token_hash=? AND device_id<>?", hash, deviceId);
            jdbc.update("INSERT INTO device_registrations(device_id,user_id,token,token_hash,platform) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),token=VALUES(token),token_hash=VALUES(token_hash),platform=VALUES(platform)", deviceId,userId,token,hash,platform);
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public void remove(Long userId, String deviceId) {
        jdbc.update("DELETE FROM device_registrations WHERE device_id=? AND user_id=?", deviceId,userId);
    }

    @Transactional
    public void mirrors(Long userId,String deviceId,java.util.List<String> ids) {
        if(ids==null||ids.size()>48||ids.stream().anyMatch(id->id==null||id.length()>64))throw new ApiException(400,"Invalid mirror receipt");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM device_registrations WHERE device_id=? AND user_id=?",Integer.class,deviceId,userId)==0)throw new ApiException(403,"Device not registered to this user");
        var owned=jdbc.queryForList("SELECT occurrence_id,scheduled_at FROM medication_logs WHERE elderly_id=? AND canceled=FALSE AND status='PENDING' AND scheduled_at>CURRENT_TIMESTAMP(6)",userId);
        jdbc.update("DELETE FROM local_notification_mirrors WHERE device_id=?",deviceId);
        for(var row:owned)if(ids.contains(row.get("occurrence_id")))jdbc.update("INSERT INTO local_notification_mirrors(device_id,occurrence_id,owner_id,expires_at) VALUES (?,?,?,?)",deviceId,row.get("occurrence_id"),userId,java.sql.Timestamp.from(((java.sql.Timestamp)row.get("scheduled_at")).toInstant().plusSeconds(900)));
    }
}
