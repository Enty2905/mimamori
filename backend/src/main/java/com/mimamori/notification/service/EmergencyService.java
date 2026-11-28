package com.mimamori.notification.service;

import com.mimamori.common.ApiException;
import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.userprofile.entity.RelationshipStatus;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmergencyService {
    private final UserRepository users;
    private final FamilyRelationshipRepository links;
    private final AlertService alerts;
    public EmergencyService(UserRepository users, FamilyRelationshipRepository links, AlertService alerts) {
        this.users = users; this.links = links; this.alerts = alerts;
    }
    public record Receipt(UUID requestId, String status, long recipientCount) {}

    @Transactional
    public Receipt create(Long userId, UUID requestId) {
        var user = users.findById(userId).orElseThrow(() -> new ApiException(401, "Invalid session"));
        if (user.getRole() != UserRole.ELDERLY) throw new ApiException(403, "Only elderly users can request emergency assistance");
        long recipients = links.findByElderlyId(userId).stream().filter(link -> link.getStatus() == RelationshipStatus.ACCEPTED).count();
        if (recipients == 0) throw new ApiException(409, "NO_LINKED_EMERGENCY_CONTACT");
        alerts.createAlert(userId, AlertType.EMERGENCY, AlertSeverity.CRITICAL,
                "Người thân yêu cầu được hỗ trợ khẩn cấp. Vui lòng liên hệ ngay.", "SOS:" + requestId);
        return new Receipt(requestId, "RECORDED", recipients);
    }
}
