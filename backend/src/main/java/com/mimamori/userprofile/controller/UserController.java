package com.mimamori.userprofile.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import com.mimamori.userprofile.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@Tag(name = "User Profile", description = "Endpoints for user profile management")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ApiResponse<UserDto> getProfile(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(userService.getUserById(userId));
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user profile")
    public ApiResponse<UserDto> updateProfile(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok("Thông tin cá nhân đã được cập nhật thành công", userService.updateProfile(userId, request.toDto()));
    }
}

