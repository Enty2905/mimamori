package com.mimamori.common;

import java.time.Instant;

public record ApiError(String code, String message, Instant timestamp) {
    public static ApiError of(int status, String message) {
        String code = switch (status) {
            case 400 -> "INVALID_REQUEST";
            case 401 -> "UNAUTHENTICATED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 503 -> "SERVICE_UNAVAILABLE";
            default -> "INTERNAL_ERROR";
        };
        return new ApiError(code, message, Instant.now());
    }
}
