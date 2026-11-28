package com.mimamori.userprofile.service;

import com.mimamori.common.ApiException;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDto getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        return UserDto.fromEntity(user);
    }

    @Transactional
    public UserDto updateProfile(Long userId, UserDto updateDto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        if (updateDto.getFullName() != null) user.setFullName(updateDto.getFullName());
        if (updateDto.getPhone() != null) user.setPhone(updateDto.getPhone());
        if (updateDto.getEmergencyContact() != null) user.setEmergencyContact(updateDto.getEmergencyContact());
        if (updateDto.getAvatarUrl() != null) user.setAvatarUrl(updateDto.getAvatarUrl());
        if (updateDto.getLanguagePreference() != null) user.setLanguagePreference(updateDto.getLanguagePreference());
        if (updateDto.getTimeZone() != null) {
            try { user.setTimeZone(updateDto.getTimeZone()); }
            catch (java.time.DateTimeException error) { throw new ApiException(400, "Invalid time zone"); }
        }

        user = userRepository.save(user);
        return UserDto.fromEntity(user);
    }
}

