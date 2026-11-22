package com.mimamori.conversation.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.DeepSeekService;
import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.DailyCheckInDto;
import com.mimamori.conversation.dto.DailyCheckInRequest;
import com.mimamori.conversation.entity.DailyCheckIn;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class CheckInService {

    private static final Logger log = LoggerFactory.getLogger(CheckInService.class);

    private final DailyCheckInRepository checkInRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final GroqService groqService;
    private final DeepSeekService deepSeekService;

    public CheckInService(
            DailyCheckInRepository checkInRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            GroqService groqService) {
        this(checkInRepository, userRepository, relationshipRepository, groqService, null);
    }

    @Autowired
    public CheckInService(
            DailyCheckInRepository checkInRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            GroqService groqService,
            @Autowired(required = false) DeepSeekService deepSeekService) {
        this.checkInRepository = checkInRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.groqService = groqService;
        this.deepSeekService = deepSeekService;
    }

    @Transactional
    public DailyCheckInDto submitCheckIn(Long elderlyId, DailyCheckInRequest request) {
        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        LocalDate today = LocalDate.now();
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
                "POOR".equalsIgnoreCase(request.getAppetite());

        checkIn.setConcerningFlag(isConcerning);

        String aiAnalysis = fetchCheckInAnalysis(
                elderlyId,
                request.getMood(),
                request.getPhysicalHealth(),
                request.getSleepQuality(),
                request.getAppetite(),
                request.getNotes()
        );
        checkIn.setAiAnalysisSummary(aiAnalysis);

        checkIn = checkInRepository.save(checkIn);
        return DailyCheckInDto.fromEntity(checkIn);
    }

    private String fetchCheckInAnalysis(
            Long elderlyId,
            String mood,
            String physicalHealth,
            String sleepQuality,
            String appetite,
            String notes) {
        if (deepSeekService != null && deepSeekService.isEnabled()) {
            try {
                String deepSeekReply = deepSeekService.analyzeCheckIn(mood, physicalHealth, sleepQuality, appetite, notes);
                if (deepSeekReply != null && !deepSeekReply.isBlank()) {
                    log.info("Check-in analysis served by provider=DeepSeek for elderlyId={}", elderlyId);
                    return deepSeekReply;
                }
                log.info("DeepSeek check-in analysis unavailable/empty for elderlyId={}, falling back to Groq", elderlyId);
            } catch (Exception e) {
                log.warn("DeepSeek check-in analysis error for elderlyId={}, falling back to Groq: {}", elderlyId, e.getMessage());
            }
        }

        if (groqService != null) {
            try {
                String groqReply = groqService.analyzeCheckIn(mood, physicalHealth, sleepQuality, appetite, notes);
                if (groqReply != null && !groqReply.isBlank()) {
                    log.info("Check-in analysis served by provider=Groq for elderlyId={}", elderlyId);
                    return groqReply;
                }
            } catch (Exception e) {
                log.warn("Groq check-in analysis error for elderlyId={}, using default fallback: {}", elderlyId, e.getMessage());
            }
        }

        return "Cháu mừng khi nhận được cập nhật sức khỏe hôm nay của bác! Bác nhớ giữ ấm cơ thể, uống nhiều nước ấm và nghỉ ngơi điều độ nhé ạ.";
    }

    public DailyCheckInDto getTodayCheckIn(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, LocalDate.now())
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
                .findFirst()
                .map(rel -> rel.getElderly().getId())
                .orElse(currentUserId);
    }
}
