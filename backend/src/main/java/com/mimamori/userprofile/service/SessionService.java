package com.mimamori.userprofile.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.JwtService;
import com.mimamori.userprofile.dto.AuthResponse;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final JwtService jwt;
    private final SecureRandom random = new SecureRandom();
    public SessionService(JdbcTemplate jdbc, UserRepository users, JwtService jwt) {
        this.jdbc = jdbc; this.users = users; this.jwt = jwt;
    }

    @Transactional
    public AuthResponse issue(User user) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("INSERT INTO refresh_sessions(token_hash,user_id,session_version,expires_at) VALUES (?,?,?,?)",
                hash(refresh), user.getId(), user.getSessionVersion(), Timestamp.from(Instant.now().plus(30, ChronoUnit.DAYS)));
        AuthResponse result = new AuthResponse(jwt.generateToken(user.getId(), user.getUsername(), user.getRole().name(), user.getSessionVersion()), UserDto.fromEntity(user));
        result.setRefreshToken(refresh);
        return result;
    }

    @Transactional
    public AuthResponse refresh(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw new ApiException(401, "Invalid session");
        var rows = jdbc.queryForList("SELECT user_id,session_version,expires_at,revoked FROM refresh_sessions WHERE token_hash=? FOR UPDATE", hash(token));
        if (rows.isEmpty()) throw new ApiException(401, "Invalid session");
        var row = rows.getFirst();
        var expires = ((Timestamp) row.get("expires_at")).toInstant();
        if (Boolean.TRUE.equals(row.get("revoked")) || !expires.isAfter(Instant.now())) throw new ApiException(401, "Session expired");
        User user = users.findById(((Number) row.get("user_id")).longValue()).orElseThrow(() -> new ApiException(401, "Invalid session"));
        if (((Number) row.get("session_version")).longValue() != user.getSessionVersion()) throw new ApiException(401, "Session revoked");
        jdbc.update("UPDATE refresh_sessions SET revoked=TRUE WHERE token_hash=?", hash(token));
        return issue(user);
    }

    @Transactional
    public void revoke(Long userId) {
        User user = users.findLockedById(userId).orElseThrow(() -> new ApiException(401, "Invalid session"));
        user.revokeSessions();
        jdbc.update("UPDATE refresh_sessions SET revoked=TRUE WHERE user_id=?", userId);
        jdbc.update("DELETE FROM device_registrations WHERE user_id=?", userId);
    }

    private String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
