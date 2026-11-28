package com.mimamori.notification.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.notification.service.DeviceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {
    private final DeviceService devices;
    public DeviceController(DeviceService devices) { this.devices = devices; }
    public record Registration(String token, String platform) {}
    public record MirrorReceipt(java.util.List<String> occurrenceIds) {}
    @PutMapping("/{id}/mirrors")
    public ApiResponse<Void> mirrors(@AuthenticationPrincipal Long userId,@PathVariable("id") String id,@RequestBody MirrorReceipt body) {
        devices.mirrors(userId,id,body.occurrenceIds());return ApiResponse.ok(null);
    }
    @PutMapping("/{id}")
    public ApiResponse<Void> register(@AuthenticationPrincipal Long userId, @PathVariable("id") String id, @RequestBody Registration body) {
        devices.register(userId,id,body.token(),body.platform()); return ApiResponse.ok(null);
    }
    @DeleteMapping("/{id}")
    public ApiResponse<Void> remove(@AuthenticationPrincipal Long userId, @PathVariable("id") String id) {
        devices.remove(userId,id); return ApiResponse.ok(null);
    }
}
