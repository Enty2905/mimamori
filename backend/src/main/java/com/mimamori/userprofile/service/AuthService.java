package com.mimamori.userprofile.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.JwtService;
import com.mimamori.userprofile.dto.AuthResponse;
import com.mimamori.userprofile.dto.LoginRequest;
import com.mimamori.userprofile.dto.RegisterRequest;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new ApiException(400, "Tên đăng nhập đã tồn tại: " + request.getUsername().trim() + ". Nếu đây là bạn, vui lòng bấm sang tab 'Đăng nhập'.");
        }
        if (userRepository.existsByEmail(request.getEmail().trim())) {
            throw new ApiException(400, "Email đã được đăng ký: " + request.getEmail().trim() + ". Nếu đây là bạn, vui lòng bấm sang tab 'Đăng nhập'.");
        }

        User user = new User(
                request.getUsername().trim(),
                request.getEmail().trim(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName(),
                request.getRole()
        );
        user.setPhone(request.getPhone());
        user.setEmergencyContact(request.getEmergencyContact());

        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getRole().name());
        return new AuthResponse(token, UserDto.fromEntity(user));
    }

    public AuthResponse login(LoginRequest request) {
        String identifier = request.getUsernameOrEmail();
        if (identifier == null || identifier.isBlank() || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ApiException(400, "Vui lòng nhập tên đăng nhập / email và mật khẩu");
        }

        User user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .or(() -> userRepository.findByUsername(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new ApiException(401, "Tên đăng nhập hoặc mật khẩu không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ApiException(401, "Tên đăng nhập hoặc mật khẩu không chính xác");
        }

        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getRole().name());
        return new AuthResponse(token, UserDto.fromEntity(user));
    }

    public UserDto getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        return UserDto.fromEntity(user);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(404, "Người dùng không tồn tại"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException(400, "Mật khẩu hiện tại không chính xác");
        }

        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new ApiException(400, "Mật khẩu mới phải có ít nhất 6 ký tự");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        userRepository.save(user);
    }

    @Transactional
    public void resetPassword(String usernameOrEmail, String newPassword) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            throw new ApiException(400, "Vui lòng nhập tên đăng nhập hoặc email");
        }

        String identifier = usernameOrEmail.trim();
        User user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .or(() -> userRepository.findByUsername(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new ApiException(404, "Không tìm thấy tài khoản với thông tin đã cung cấp"));

        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new ApiException(400, "Mật khẩu mới phải có ít nhất 6 ký tự");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        userRepository.save(user);
    }
}

