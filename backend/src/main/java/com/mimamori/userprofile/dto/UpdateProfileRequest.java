package com.mimamori.userprofile.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Writable profile fields only; identity and role are never accepted as updates. */
public record UpdateProfileRequest(
        @Size(min = 1, max = 100) @Pattern(regexp = "(?s).*\\S.*") String fullName,
        @Size(max = 30) String phone,
        @Size(max = 30) String emergencyContact,
        @Size(max = 2048) String avatarUrl,
        @Pattern(regexp = "ja|vi") String languagePreference,
        @Size(max = 100) String timeZone) {
    public UserDto toDto() {
        var dto = new UserDto();
        dto.setFullName(fullName == null ? null : fullName.strip());
        dto.setPhone(phone);
        dto.setEmergencyContact(emergencyContact);
        dto.setAvatarUrl(avatarUrl);
        dto.setLanguagePreference(languagePreference);
        dto.setTimeZone(timeZone);
        return dto;
    }
}
