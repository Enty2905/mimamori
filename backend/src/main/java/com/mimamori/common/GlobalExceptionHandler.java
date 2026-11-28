package com.mimamori.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.dao.DataIntegrityViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> api(ApiException error) {
        return ResponseEntity.status(error.getStatus()).body(ApiError.of(error.getStatus(), error.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ApiError> validation(Exception error) {
        return ResponseEntity.badRequest().body(ApiError.of(400, "Request data is invalid"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> method(Exception error) {
        return ResponseEntity.status(405).body(new ApiError("METHOD_NOT_ALLOWED", "Method not supported", java.time.Instant.now()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> conflict(Exception error) {
        return ResponseEntity.status(409).body(ApiError.of(409, "The request conflicts with existing data"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error) {
        return ResponseEntity.internalServerError().body(ApiError.of(500, "An unexpected error occurred"));
    }
}
