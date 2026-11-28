package com.mimamori.common;

import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {

    private final String secretKey;
    private final long expirationMs;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public JwtService(
            @Value("${mimamori.jwt.secret}") String secretKey,
            @Value("${mimamori.jwt.expiration-ms:86400000}") long expirationMs) {
        validateSecret(secretKey);
        this.secretKey = secretKey;
        this.expirationMs = expirationMs;
        this.objectMapper = new ObjectMapper();
    }

    public JwtService(String secretKey, long expirationMs, ObjectMapper objectMapper) {
        validateSecret(secretKey);
        this.secretKey = secretKey;
        this.expirationMs = expirationMs;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    public String generateToken(Long userId, String username, String role) {
        return generateToken(userId, username, role, 0);
    }

    public String generateToken(Long userId, String username, String role, long version) {
        try {
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            long now = Instant.now().getEpochSecond();
            long exp = now + (expirationMs / 1000);

            Map<String, Object> payload = new HashMap<>();
            payload.put("sub", username);
            payload.put("userId", userId);
            payload.put("role", role);
            payload.put("version", version);
            payload.put("iat", now);
            payload.put("exp", exp);

            String encodedHeader = base64UrlEncode(objectMapper.writeValueAsString(header).getBytes(StandardCharsets.UTF_8));
            String encodedPayload = base64UrlEncode(objectMapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));

            String content = encodedHeader + "." + encodedPayload;
            String signature = signHmacSha256(content, secretKey);

            return content + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate JWT token", e);
        }
    }

    public boolean validateToken(String token) {
        try {
            if (token == null || token.length() > 8192) return false;
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return false;
            }
            Map<?, ?> header = objectMapper.readValue(Base64.getUrlDecoder().decode(parts[0]), Map.class);
            if (!"HS256".equals(header.get("alg")) || !"JWT".equals(header.get("typ"))) return false;

            String content = parts[0] + "." + parts[1];
            String expectedSignature = signHmacSha256(content, secretKey);
            if (!MessageDigest.isEqual(parts[2].getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
                return false;
            }

            Map<String, Object> payload = getClaims(token);
            long exp = ((Number) payload.get("exp")).longValue();
            long now = Instant.now().getEpochSecond();

            return now < exp;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getClaims(String token) {
        try {
            String[] parts = token.split("\\.");
            byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
            return objectMapper.readValue(decoded, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract JWT claims", e);
        }
    }

    public String getUsernameFromToken(String token) {
        return (String) getClaims(token).get("sub");
    }

    public Long getUserIdFromToken(String token) {
        Object id = getClaims(token).get("userId");
        if (id instanceof Number) {
            return ((Number) id).longValue();
        }
        return Long.parseLong(id.toString());
    }

    public String getRoleFromToken(String token) {
        return (String) getClaims(token).get("role");
    }

    private String signHmacSha256(String data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return base64UrlEncode(rawHmac);
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static void validateSecret(String value) {
        if (value == null || value.getBytes(StandardCharsets.UTF_8).length < 32
                || value.startsWith("mimamori-super-secret")) {
            throw new IllegalArgumentException("JWT_SECRET must be a private, randomly generated value of at least 32 bytes");
        }
    }
}
