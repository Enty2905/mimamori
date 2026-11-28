package com.mimamori.conversation.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.DailyCheckInDto;
import com.mimamori.conversation.dto.DailyCheckInRequest;
import com.mimamori.conversation.entity.DailyCheckIn;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class CheckInService {

    private final DailyCheckInRepository checkInRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final GroqService groqService;
    private final com.mimamori.notification.service.AlertService alerts;

    public CheckInService(
            DailyCheckInRepository checkInRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            GroqService groqService, com.mimamori.notification.service.AlertService alerts) {
        this.checkInRepository = checkInRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.groqService = groqService;
        this.alerts = alerts;
    }

    @Transactional
    public DailyCheckInDto submitCheckIn(Long elderlyId, DailyCheckInRequest request) {
        User elderly = userRepository.findLockedById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        if (elderly.getRole() != com.mimamori.userprofile.entity.UserRole.ELDERLY) throw new ApiException(403, "Only elderly users can submit their check-in");
        request.setMood(com.mimamori.conversation.dto.CheckInSignals.normalize(request.getMood(), "mood"));
        request.setPhysicalHealth(com.mimamori.conversation.dto.CheckInSignals.normalize(request.getPhysicalHealth(), "physicalHealth"));
        request.setSleepQuality(com.mimamori.conversation.dto.CheckInSignals.normalize(request.getSleepQuality(), "sleepQuality"));
        request.setAppetite(com.mimamori.conversation.dto.CheckInSignals.normalize(request.getAppetite(), "appetite"));

        LocalDate today = LocalDate.now(java.time.ZoneId.of(elderly.getTimeZone()));
        DailyCheckIn checkIn = checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, today)
                .orElse(new DailyCheckIn());

        checkIn.setElderly(elderly);
        checkIn.setCheckinDate(today);
        checkIn.setMood(request.getMood());
        checkIn.setPhysicalHealth(request.getPhysicalHealth());
        checkIn.setSleepQuality(request.getSleepQuality());
        checkIn.setAppetite(request.getAppetite());
        checkIn.setNotes(request.getNotes());

        // Basic Rule-based concern detection
        boolean isConcerning = "POOR".equalsIgnoreCase(request.getMood()) ||
                "TIRED".equalsIgnoreCase(request.getMood()) ||
                "PAIN".equalsIgnoreCase(request.getPhysicalHealth()) ||
                "DIZZY".equalsIgnoreCase(request.getPhysicalHealth()) ||
                "INSOMNIA".equalsIgnoreCase(request.getSleepQuality()) ||
                "POOR".equalsIgnoreCase(request.getSleepQuality()) ||
                "POOR".equalsIgnoreCase(request.getAppetite());

        checkIn.setConcerningFlag(isConcerning);

        String aiAnalysis = isConcerning
                ? ("ja".equals(elderly.getLanguagePreference()) ? "気になる体調の変化があります。ご家族や医療機関に相談してください。" : "Cụ ghi nhận dấu hiệu cần lưu ý. Cụ hãy liên hệ người thân hoặc nhân viên y tế để được hỗ trợ.")
                : ("ja".equals(elderly.getLanguagePreference()) ? "本日の体調を記録しました。" : "Đã ghi nhận tình trạng hôm nay của cụ.");
        checkIn.setAiAnalysisSummary(aiAnalysis);

        checkIn = checkInRepository.save(checkIn);
        if (isConcerning) alerts.createAlert(elderlyId, com.mimamori.notification.entity.AlertType.CHECKIN_CONCERN,
                com.mimamori.notification.entity.AlertSeverity.HIGH, "Check-in ghi nhận dấu hiệu cần lưu ý. Vui lòng liên hệ người thân.", "CHECKIN:" + today);
        return DailyCheckInDto.fromEntity(checkIn);
    }

    public DailyCheckInDto getTodayCheckIn(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, LocalDate.now(java.time.ZoneId.of(userRepository.findById(elderlyId).orElseThrow().getTimeZone())))
                .map(DailyCheckInDto::fromEntity)
                .orElse(null);
    }

    public List<DailyCheckInDto> getHistory(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return checkInRepository.findByElderlyIdOrderByCheckinDateDesc(elderlyId)
                .stream()
                .limit(30)
                .map(DailyCheckInDto::fromEntity)
                .collect(Collectors.toList());
    }

    private Long resolveElderlyId(Long currentUserId, Long targetElderlyId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        if (currentUser.getRole() == com.mimamori.userprofile.entity.UserRole.ELDERLY) {
            return currentUserId;
        }
        if (targetElderlyId != null) {
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, targetElderlyId)) {
                throw new ApiException(403, "You are not authorized to view this elderly member's check-in data");
            }
            return targetElderlyId;
        }
        return relationshipRepository.findByCaregiverId(currentUserId)
                .stream()
                .filter(link -> link.getStatus() == com.mimamori.userprofile.entity.RelationshipStatus.ACCEPTED)
                .findFirst()
                .map(rel -> rel.getElderly().getId())
                .orElse(currentUserId);
    }
}
