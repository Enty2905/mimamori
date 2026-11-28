package com.mimamori;

import tools.jackson.databind.ObjectMapper;
import com.mimamori.common.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(
                "test-secret-key-that-is-at-least-256-bits-long-for-hmac-sha256-compliance!",
                3600000,
                new ObjectMapper()
        );
    }

    @Test
    void shouldGenerateAndValidateTokenSuccessfully() {
        String token = jwtService.generateToken(1L, "elderly_user", "ELDERLY");
        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));

        assertEquals("elderly_user", jwtService.getUsernameFromToken(token));
        assertEquals(1L, jwtService.getUserIdFromToken(token));
        assertEquals("ELDERLY", jwtService.getRoleFromToken(token));
    }

    @Test
    void shouldRejectTamperedToken() {
        String token = jwtService.generateToken(1L, "elderly_user", "ELDERLY");
        String tampered = token.substring(0, token.length() - 5) + "abcde";
        assertFalse(jwtService.validateToken(tampered));
    }

    @Test
    void rejectsWeakOrMissingSecrets() {
        assertThrows(IllegalArgumentException.class, () -> new JwtService("", 1000, new ObjectMapper()));
        assertThrows(IllegalArgumentException.class, () -> new JwtService("short", 1000, new ObjectMapper()));
        assertThrows(IllegalArgumentException.class, () -> new JwtService(null, 1000, new ObjectMapper()));
    }

    @Test
    void rejectsMalformedAndExpiredTokens() {
        assertFalse(jwtService.validateToken(null));
        assertFalse(jwtService.validateToken("not.a.token"));
        JwtService expired = new JwtService("synthetic-secret-that-is-at-least-32-bytes-long", -1000, new ObjectMapper());
        assertFalse(expired.validateToken(expired.generateToken(1L, "user", "ELDERLY")));
    }
}

