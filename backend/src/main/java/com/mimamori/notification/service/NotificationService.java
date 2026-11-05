package com.mimamori.notification.service;

import com.mimamori.common.ApiException;
import com.mimamori.notification.dto.NotificationDto;
import com.mimamori.notification.entity.Notification;
import com.mimamori.notification.repository.NotificationRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public NotificationDto sendNotification(Long userId, String title, String body, String type, Long referenceId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        Notification notif = new Notification();
        notif.setUser(user);
        notif.setTitle(title);
        notif.setBody(body);
        notif.setType(type);
        notif.setReferenceId(referenceId);
        notif.setIsRead(false);

        notif = notificationRepository.save(notif);
        return NotificationDto.fromEntity(notif);
    }

    public List<NotificationDto> getNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markAsRead(Long userId, Long notificationId) {
        Notification notif = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ApiException(404, "Notification not found"));
        if (notif.getUser().getId().equals(userId)) {
            notif.setIsRead(true);
            notificationRepository.save(notif);
        }
    }
}

