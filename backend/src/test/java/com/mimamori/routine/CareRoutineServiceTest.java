package com.mimamori.routine;

import com.mimamori.common.ApiException;
import com.mimamori.conversation.entity.DailyCheckIn;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.notification.service.NotificationService;
import com.mimamori.routine.dto.CareRoutineConfigRequest;
import com.mimamori.routine.dto.ConfirmCareRoutineRequest;
import com.mimamori.routine.dto.DailyRoutineOverviewDto;
import com.mimamori.routine.entity.CareRoutine;
import com.mimamori.routine.entity.CareRoutineLog;
import com.mimamori.routine.repository.CareRoutineLogRepository;
import com.mimamori.routine.repository.CareRoutineRepository;
import com.mimamori.routine.service.CareRoutineService;
import com.mimamori.userprofile.entity.FamilyRelationship;
import com.mimamori.userprofile.entity.RelationshipStatus;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CareRoutineServiceTest {

    @Mock
    private CareRoutineRepository routineRepository;
    @Mock
    private CareRoutineLogRepository logRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FamilyRelationshipRepository relationshipRepository;
    @Mock
    private DailyCheckInRepository checkInRepository;
    @Mock
    private NotificationService notificationService;

    private CareRoutineService service;
    private User elderly;
    private User caregiver;

    @BeforeEach
    void setUp() {
        service = new CareRoutineService(
                routineRepository,
                logRepository,
                userRepository,
                relationshipRepository,
                checkInRepository,
                notificationService
        );

        elderly = new User();
        elderly.setId(1L);
        elderly.setUsername("ong_ba");
        elderly.setFullName("Nguyễn Văn Ba");
        elderly.setRole(UserRole.ELDERLY);

        caregiver = new User();
        caregiver.setId(2L);
        caregiver.setUsername("con_gai");
        caregiver.setFullName("Nguyễn Thị Lan");
        caregiver.setRole(UserRole.CAREGIVER);
    }

    @Test
    void getTodayRoutine_autoProvisionsDefaultConfigAndSlots_withSleepQuality() {
        LocalDate today = LocalDate.now();
        when(userRepository.findById(1L)).thenReturn(Optional.of(elderly));
        when(routineRepository.findByElderlyId(1L)).thenReturn(Optional.empty());
        when(routineRepository.save(any(CareRoutine.class))).thenAnswer(inv -> {
            CareRoutine r = inv.getArgument(0);
            r.setId(10L);
            return r;
        });

        List<CareRoutineLog> storedLogs = new ArrayList<>();
        AtomicLong idGen = new AtomicLong(100L);
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenAnswer(inv -> new ArrayList<>(storedLogs));
        when(logRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<CareRoutineLog> batch = inv.getArgument(0);
            for (CareRoutineLog item : batch) {
                if (item.getId() == null) {
                    item.setId(idGen.getAndIncrement());
                }
                storedLogs.add(item);
            }
            return batch;
        });

        DailyCheckIn checkIn = new DailyCheckIn();
        checkIn.setSleepQuality("GOOD");
        when(checkInRepository.findByElderlyIdAndCheckinDate(1L, today)).thenReturn(Optional.of(checkIn));

        DailyRoutineOverviewDto overview = service.getTodayRoutine(1L, null);

        assertEquals(1L, overview.getElderlyId());
        assertEquals(7, overview.getWaterTargetCups());
        assertEquals(1400, overview.getWaterTargetMl());
        assertEquals(200, overview.getWaterCupMl());
        assertEquals(0, overview.getWaterCompletedCups());
        assertEquals(0, overview.getWaterCompletedMl());
        assertEquals(0, overview.getHydrationPercent());
        assertEquals("NEEDS_MORE", overview.getHydrationStatus());
        assertEquals(List.of("08:00", "10:30", "14:00", "16:30", "20:00"), overview.getWaterReminderTimes());
        assertTrue(overview.isWaterEnabled());
        assertEquals("21:30", overview.getBedtimeTime());
        assertEquals("06:00", overview.getWakeupTime());
        assertEquals(8.0, overview.getSleepTargetHours());
        assertTrue(overview.isSleepEnabled());
        assertEquals("PENDING", overview.getSleepStatus());
        assertNull(overview.getSleepCompletedAt());
        assertEquals("GOOD", overview.getLastNightSleepQuality());
        assertEquals(6, overview.getLogs().size()); // 5 water + 1 sleep
    }

    @Test
    void updateConfig_reconcilesPendingSlots_andPreservesCompletedLogs() {
        LocalDate today = LocalDate.now();
        when(userRepository.findById(2L)).thenReturn(Optional.of(caregiver));
        when(userRepository.findById(1L)).thenReturn(Optional.of(elderly));
        when(relationshipRepository.existsByCaregiverIdAndElderlyId(2L, 1L)).thenReturn(true);

        CareRoutine existingRoutine = new CareRoutine();
        existingRoutine.setId(10L);
        existingRoutine.setElderly(elderly);
        existingRoutine.setWaterReminderTimes("08:00,10:30");
        existingRoutine.setBedtimeTime("21:30");
        when(routineRepository.findByElderlyId(1L)).thenReturn(Optional.of(existingRoutine));
        when(routineRepository.save(any(CareRoutine.class))).thenAnswer(inv -> inv.getArgument(0));

        CareRoutineLog completed0800 = new CareRoutineLog();
        completed0800.setId(1L);
        completed0800.setElderly(elderly);
        completed0800.setRoutineDate(today);
        completed0800.setRoutineType("WATER");
        completed0800.setScheduledTime("08:00");
        completed0800.setStatus("COMPLETED");
        completed0800.setCompletedAt(LocalDateTime.now());

        CareRoutineLog pending1030 = new CareRoutineLog();
        pending1030.setId(2L);
        pending1030.setElderly(elderly);
        pending1030.setRoutineDate(today);
        pending1030.setRoutineType("WATER");
        pending1030.setScheduledTime("10:30");
        pending1030.setStatus("PENDING");

        CareRoutineLog pendingSleep = new CareRoutineLog();
        pendingSleep.setId(3L);
        pendingSleep.setElderly(elderly);
        pendingSleep.setRoutineDate(today);
        pendingSleep.setRoutineType("SLEEP");
        pendingSleep.setScheduledTime("21:30");
        pendingSleep.setStatus("PENDING");

        List<CareRoutineLog> dbLogs = new ArrayList<>(List.of(completed0800, pending1030, pendingSleep));
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenAnswer(inv -> new ArrayList<>(dbLogs));
        doAnswer(inv -> {
            List<CareRoutineLog> deleted = inv.getArgument(0);
            dbLogs.removeAll(deleted);
            return null;
        }).when(logRepository).deleteAll(anyList());
        when(logRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<CareRoutineLog> created = inv.getArgument(0);
            long nextId = 50L;
            for (CareRoutineLog l : created) {
                l.setId(nextId++);
                dbLogs.add(l);
            }
            return created;
        });
        when(checkInRepository.findByElderlyIdAndCheckinDate(1L, today)).thenReturn(Optional.empty());

        CareRoutineConfigRequest req = new CareRoutineConfigRequest();
        req.setWaterTargetCups(6);
        // Remove 08:00 (already completed -> must be preserved!) and 10:30 (pending -> must be deleted!), add 15:00 & 9:00
        req.setWaterReminderTimes(List.of("15:00", "9:00"));
        req.setBedtimeTime("22:00");
        req.setWakeupTime("06:30");
        req.setSleepTargetHours(8.5);
        req.setWaterEnabled(true);
        req.setSleepEnabled(true);

        DailyRoutineOverviewDto result = service.updateConfig(2L, 1L, req);

        assertEquals(6, result.getWaterTargetCups());
        assertEquals(List.of("09:00", "15:00"), result.getWaterReminderTimes());
        assertEquals("22:00", result.getBedtimeTime());
        assertEquals("06:30", result.getWakeupTime());
        assertEquals(8.5, result.getSleepTargetHours());
        // Completed 08:00 log was preserved, so completed cups stays 1
        assertEquals(1, result.getWaterCompletedCups());

        // Verify pending 10:30 & pending 21:30 were deleted
        ArgumentCaptor<List<CareRoutineLog>> deleteCaptor = ArgumentCaptor.forClass(List.class);
        verify(logRepository).deleteAll(deleteCaptor.capture());
        assertEquals(2, deleteCaptor.getValue().size());
        assertTrue(deleteCaptor.getValue().contains(pending1030));
        assertTrue(deleteCaptor.getValue().contains(pendingSleep));

        // Remaining logs: completed 08:00 + new pending 09:00, 15:00 + new pending sleep 22:00
        assertEquals(4, result.getLogs().size());
        assertTrue(result.getLogs().stream().anyMatch(l -> "08:00".equals(l.getScheduledTime()) && "COMPLETED".equals(l.getStatus())));
        assertTrue(result.getLogs().stream().anyMatch(l -> "09:00".equals(l.getScheduledTime()) && "PENDING".equals(l.getStatus())));
        assertTrue(result.getLogs().stream().anyMatch(l -> "15:00".equals(l.getScheduledTime()) && "PENDING".equals(l.getStatus())));
        assertTrue(result.getLogs().stream().anyMatch(l -> "SLEEP".equals(l.getRoutineType()) && "22:00".equals(l.getScheduledTime()) && "PENDING".equals(l.getStatus())));
    }

    @Test
    void updateConfig_rejectsUnlinkedCaregiverAndCrossElderlyAccess() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(caregiver));
        when(relationshipRepository.existsByCaregiverIdAndElderlyId(2L, 1L)).thenReturn(false);

        CareRoutineConfigRequest req = new CareRoutineConfigRequest();
        req.setWaterTargetCups(8);

        ApiException caregiverEx = assertThrows(ApiException.class, () -> service.updateConfig(2L, 1L, req));
        assertEquals(403, caregiverEx.getStatus());

        when(userRepository.findById(1L)).thenReturn(Optional.of(elderly));
        ApiException elderlyEx = assertThrows(ApiException.class, () -> service.updateConfig(1L, 99L, req));
        assertEquals(403, elderlyEx.getStatus());
    }

    @Test
    void confirmLog_marksCompleted_setsTimestamp_andNotifiesLinkedCaregivers() {
        LocalDate today = LocalDate.now();
        CareRoutine routine = new CareRoutine();
        routine.setId(10L);
        routine.setElderly(elderly);
        routine.setWaterTargetCups(6);
        routine.setBedtimeTime("21:30");

        CareRoutineLog sleepLog = new CareRoutineLog();
        sleepLog.setId(55L);
        sleepLog.setElderly(elderly);
        sleepLog.setRoutineDate(today);
        sleepLog.setRoutineType("SLEEP");
        sleepLog.setScheduledTime("21:30");
        sleepLog.setStatus("PENDING");

        when(logRepository.findById(55L)).thenReturn(Optional.of(sleepLog));
        when(logRepository.save(any(CareRoutineLog.class))).thenAnswer(inv -> inv.getArgument(0));
        when(routineRepository.findByElderlyId(1L)).thenReturn(Optional.of(routine));
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenReturn(List.of(sleepLog));
        when(checkInRepository.findByElderlyIdAndCheckinDate(1L, today)).thenReturn(Optional.empty());

        FamilyRelationship rel = new FamilyRelationship(caregiver, elderly, "CHILD", RelationshipStatus.ACCEPTED);
        when(relationshipRepository.findByElderlyId(1L)).thenReturn(List.of(rel));

        ConfirmCareRoutineRequest req = new ConfirmCareRoutineRequest();
        req.setNote("Tôi đã đi ngủ đúng giờ");

        DailyRoutineOverviewDto dto = service.confirmLog(1L, 55L, req);

        assertEquals("COMPLETED", dto.getSleepStatus());
        assertNotNull(dto.getSleepCompletedAt());
        assertEquals("Tôi đã đi ngủ đúng giờ", sleepLog.getNote());
        verify(notificationService).sendNotification(
                eq(2L),
                contains("Đã đi ngủ"),
                contains("Nguyễn Văn Ba"),
                eq("REMINDER"),
                eq(55L)
        );
    }

    @Test
    void quickAddWater_logsExtraCupCompleted_andNotifiesCaregivers() {
        LocalDate today = LocalDate.now();
        CareRoutine routine = new CareRoutine();
        routine.setId(10L);
        routine.setElderly(elderly);
        routine.setWaterTargetCups(8);
        routine.setWaterReminderTimes("08:00");
        routine.setBedtimeTime("21:30");

        CareRoutineLog scheduled0800 = new CareRoutineLog();
        scheduled0800.setId(1L);
        scheduled0800.setElderly(elderly);
        scheduled0800.setRoutineDate(today);
        scheduled0800.setRoutineType("WATER");
        scheduled0800.setScheduledTime("08:00");
        scheduled0800.setStatus("COMPLETED");

        CareRoutineLog extra1 = new CareRoutineLog();
        extra1.setId(2L);
        extra1.setElderly(elderly);
        extra1.setRoutineDate(today);
        extra1.setRoutineType("WATER");
        extra1.setScheduledTime("EXTRA-1");
        extra1.setStatus("COMPLETED");

        CareRoutineLog sleepSlot = new CareRoutineLog();
        sleepSlot.setId(3L);
        sleepSlot.setElderly(elderly);
        sleepSlot.setRoutineDate(today);
        sleepSlot.setRoutineType("SLEEP");
        sleepSlot.setScheduledTime("21:30");
        sleepSlot.setStatus("PENDING");

        when(userRepository.findById(1L)).thenReturn(Optional.of(elderly));
        when(routineRepository.findByElderlyId(1L)).thenReturn(Optional.of(routine));
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenReturn(List.of(scheduled0800, extra1, sleepSlot));
        when(logRepository.save(any(CareRoutineLog.class))).thenAnswer(inv -> {
            CareRoutineLog saved = inv.getArgument(0);
            saved.setId(99L);
            return saved;
        });
        when(checkInRepository.findByElderlyIdAndCheckinDate(1L, today)).thenReturn(Optional.empty());

        FamilyRelationship rel = new FamilyRelationship(caregiver, elderly, "CHILD", RelationshipStatus.ACCEPTED);
        when(relationshipRepository.findByElderlyId(1L)).thenReturn(List.of(rel));

        DailyRoutineOverviewDto dto = service.quickAddWater(1L, null, null);

        assertEquals(3, dto.getWaterCompletedCups());
        assertEquals(600, dto.getWaterCompletedMl());
        assertTrue(dto.getLogs().stream().anyMatch(l -> "EXTRA-2".equals(l.getScheduledTime()) && "COMPLETED".equals(l.getStatus())));
        verify(notificationService).sendNotification(
                eq(2L),
                contains("Đã uống nước"),
                contains("3/8"),
                eq("REMINDER"),
                eq(99L)
        );
    }

    @Test
    void updateConfig_dividesLitersIntoCups_andEvaluatesHydrationProgress() {
        LocalDate today = LocalDate.now();
        when(userRepository.findById(2L)).thenReturn(Optional.of(caregiver));
        when(userRepository.findById(1L)).thenReturn(Optional.of(elderly));
        when(relationshipRepository.existsByCaregiverIdAndElderlyId(2L, 1L)).thenReturn(true);

        CareRoutine existingRoutine = new CareRoutine();
        existingRoutine.setId(10L);
        existingRoutine.setElderly(elderly);
        when(routineRepository.findByElderlyId(1L)).thenReturn(Optional.of(existingRoutine));
        when(routineRepository.save(any(CareRoutine.class))).thenAnswer(inv -> inv.getArgument(0));
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenReturn(new ArrayList<>());
        when(logRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(checkInRepository.findByElderlyIdAndCheckinDate(1L, today)).thenReturn(Optional.empty());

        CareRoutineConfigRequest req = new CareRoutineConfigRequest();
        req.setWaterTargetMl(1500);
        req.setWaterCupMl(250);

        DailyRoutineOverviewDto updated = service.updateConfig(2L, 1L, req);
        assertEquals(1500, updated.getWaterTargetMl());
        assertEquals(250, updated.getWaterCupMl());
        assertEquals(6, updated.getWaterTargetCups()); // 1500ml / 250ml = 6 cups

        // Simulate 6 completed cups -> 1500ml -> TARGET_ACHIEVED
        List<CareRoutineLog> completedLogs = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            CareRoutineLog l = new CareRoutineLog();
            l.setId((long) i);
            l.setElderly(elderly);
            l.setRoutineDate(today);
            l.setRoutineType("WATER");
            l.setScheduledTime("0" + i + ":00");
            l.setStatus("COMPLETED");
            completedLogs.add(l);
        }
        when(logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(1L, today))
                .thenReturn(completedLogs);
        DailyRoutineOverviewDto achieved = service.getTodayRoutine(1L, null);
        assertEquals(1500, achieved.getWaterCompletedMl());
        assertEquals(100, achieved.getHydrationPercent());
        assertEquals("TARGET_ACHIEVED", achieved.getHydrationStatus());
    }
}
