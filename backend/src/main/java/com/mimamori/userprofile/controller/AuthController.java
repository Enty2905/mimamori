package com.mimamori.userprofile.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.userprofile.dto.AuthResponse;
import com.mimamori.userprofile.dto.ChangePasswordRequest;
import com.mimamori.userprofile.dto.ForgotPasswordRequest;
import com.mimamori.userprofile.dto.LoginRequest;
import com.mimamori.userprofile.dto.RegisterRequest;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Endpoints for user registration and authentication")
public class AuthController {

    private final AuthService authService;
    private final com.mimamori.userprofile.service.SessionService sessions;

    public AuthController(AuthService authService, com.mimamori.userprofile.service.SessionService sessions) {
        this.authService = authService;
        this.sessions = sessions;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new user (ELDERLY or CAREGIVER)")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok("User registered successfully", authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate user and retrieve JWT token")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Login successful", authService.login(request));
    }

    public record RefreshRequest(@jakarta.validation.constraints.NotBlank String refreshToken) {}

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok(sessions.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@AuthenticationPrincipal Long userId) {
        sessions.revoke(userId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/me")
    @Operation(summary = "Retrieve current authenticated user profile")
    public ApiResponse<UserDto> getMe(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(authService.getCurrentUser(userId));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change password for authenticated user")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(userId, request.getCurrentPassword(), request.getNewPassword());
        return ApiResponse.ok("Đổi mật khẩu thành công", null);
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Reset password using registered username or email")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.resetPassword(request.getUsernameOrEmail(), request.getNewPassword());
        return ApiResponse.ok("Khôi phục mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.", null);
    }
}
