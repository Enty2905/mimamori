package com.mimamori;

import com.mimamori.common.JwtService;
import com.mimamori.notification.entity.*;
import com.mimamori.notification.repository.CareAlertRepository;
import com.mimamori.userprofile.entity.*;
import com.mimamori.userprofile.repository.*;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Security and persistence regression tests against real MySQL and Flyway. Docker required. */
@SpringBootTest
@Testcontainers
class RemediationIntegrationTest {
    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4.10");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", mysql::getJdbcUrl);
        properties.add("spring.datasource.username", mysql::getUsername);
        properties.add("spring.datasource.password", mysql::getPassword);
        properties.add("mimamori.jwt.secret", () -> "integration-only-private-key-32-bytes-or-more-do-not-deploy");
        properties.add("spring.ai.model.chat", () -> "none");
        properties.add("mimamori.queue.redis-enabled", () -> "false");
    }

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired FamilyRelationshipRepository links;
    @Autowired CareAlertRepository alerts;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @Autowired com.mimamori.medication.repository.MedicationLogRepository doses;
    @Autowired com.mimamori.medication.reminder.ReminderService reminders;
    @Autowired org.quartz.Scheduler scheduler;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.mimamori.notification.service.PushDispatcher dispatcher;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    com.mimamori.notification.service.PushGateway push;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    com.mimamori.common.GroqService companion;
    MockMvc mvc;
    User elder;
    User caregiver;
    User outsider;
    String elderToken;
    String caregiverToken;
    String outsiderToken;
    final String password = "Synthetic-test-password-2026!";

    @BeforeEach
    void setup() {
        org.mockito.Mockito.lenient().when(push.send(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn(com.mimamori.notification.service.PushGateway.Result.UNAVAILABLE);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        elder = user(UserRole.ELDERLY);
        caregiver = user(UserRole.CAREGIVER);
        outsider = user(UserRole.CAREGIVER);
        links.save(new FamilyRelationship(caregiver, elder, "FAMILY", RelationshipStatus.ACCEPTED));
        elderToken = jwt.generateToken(elder.getId(), elder.getUsername(), "ELDERLY");
        caregiverToken = jwt.generateToken(caregiver.getId(), caregiver.getUsername(), "CAREGIVER");
        outsiderToken = jwt.generateToken(outsider.getId(), outsider.getUsername(), "CAREGIVER");
    }

    User user(UserRole role) {
        String username = "test_" + UUID.randomUUID().toString().substring(0, 16);
        return users.save(new User(username, username + "@example.invalid", passwords.encode(password), "Synthetic Test", role));
    }

    String body(Object value) { return json.writeValueAsString(value); }
    JsonNode data(String content) { return json.readTree(content).path("data"); }

    @Test
    void anonymousResetCannotChangePasswordOrEnumerateAccount() throws Exception {
        for (String identifier : new String[]{elder.getUsername(), "unknown_account"}) {
            mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                    .content(body(Map.of("usernameOrEmail", identifier, "newPassword", "Attacker-replacement!"))))
                    .andExpect(status().isServiceUnavailable());
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("usernameOrEmail", elder.getUsername(), "password", password))))
                .andExpect(status().isOk());
        assertTrue(passwords.matches(password, users.findById(elder.getId()).orElseThrow().getPasswordHash()));
    }

    @Test
    void privateAuthRoutesRequireAuthentication() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/change-password").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("currentPassword", password, "newPassword", "Another-password!"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void outsidersCannotReadOrResolveAlertsAndRevokedLinksLoseAccess() throws Exception {
        CareAlert alert = new CareAlert();
        alert.setElderly(elder);
        alert.setCaregiver(caregiver);
        alert.setAlertType(AlertType.CHECKIN_CONCERN);
        alert.setSeverity(AlertSeverity.HIGH);
        alert.setDescription("Synthetic test only");
        alert = alerts.save(alert);
        String path = "/api/alerts/" + alert.getId();
        mvc.perform(put(path + "/read").header("Authorization", "Bearer " + outsiderToken)).andExpect(status().isForbidden());
        mvc.perform(put(path + "/resolve").header("Authorization", "Bearer " + outsiderToken)).andExpect(status().isForbidden());
        assertFalse(alerts.findById(alert.getId()).orElseThrow().getIsResolved());
        mvc.perform(put(path + "/read").header("Authorization", "Bearer " + caregiverToken)).andExpect(status().isOk());
        links.delete(links.findByCaregiverIdAndElderlyId(caregiver.getId(), elder.getId()).orElseThrow());
        mvc.perform(put(path + "/resolve").header("Authorization", "Bearer " + caregiverToken)).andExpect(status().isForbidden());
        mvc.perform(put(path + "/resolve").header("Authorization", "Bearer " + elderToken)).andExpect(status().isOk());
    }

    @Test
    void refreshRotatesAndLogoutInvalidatesAccessAndRefreshTokens() throws Exception {
        var login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("usernameOrEmail", elder.getUsername(), "password", password))))
                .andExpect(status().isOk()).andReturn();
        String refresh = data(login.getResponse().getContentAsString()).path("refreshToken").asText();
        var rotation = mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("refreshToken", refresh))))
                .andExpect(status().isOk()).andReturn();
        String next = data(rotation.getResponse().getContentAsString()).path("refreshToken").asText();
        assertNotEquals(refresh, next);
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("refreshToken", refresh)))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + elderToken)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + elderToken)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("refreshToken", next)))).andExpect(status().isUnauthorized());
    }

    @Test
    void legacyVietnameseCheckinFlagsConcernsWithoutAnAiProvider() throws Exception {
        var result = mvc.perform(post("/api/checkins").header("Authorization", "Bearer " + elderToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("mood", "Hơi mệt", "physicalHealth", "Chóng mặt", "sleepQuality", "Mất ngủ", "appetite", "Chán ăn"))))
                .andExpect(status().isOk()).andReturn();
        assertTrue(data(result.getResponse().getContentAsString()).path("concerningFlag").asBoolean());
        assertEquals("DIZZY", data(result.getResponse().getContentAsString()).path("physicalHealth").asText());
        mvc.perform(post("/api/checkins").header("Authorization", "Bearer " + elderToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("mood", "unknown", "physicalHealth", "GOOD", "sleepQuality", "GOOD", "appetite", "GOOD"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emergencyRecordingIsIdempotentAndNeverClaimsDeviceDelivery() throws Exception {
        String request = body(Map.of("requestId", UUID.randomUUID()));
        long before = alerts.count();
        for (int repeat = 0; repeat < 2; repeat++) {
            var result = mvc.perform(post("/api/emergencies").header("Authorization", "Bearer " + elderToken)
                    .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk()).andReturn();
            assertEquals("RECORDED", data(result.getResponse().getContentAsString()).path("status").asText());
            assertEquals(1, data(result.getResponse().getContentAsString()).path("recipientCount").asLong());
        }
        assertEquals(before + 1, alerts.count());
        mvc.perform(post("/api/emergencies").header("Authorization", "Bearer " + caregiverToken)
                .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isForbidden());
        links.delete(links.findByCaregiverIdAndElderlyId(caregiver.getId(), elder.getId()).orElseThrow());
        mvc.perform(post("/api/emergencies").header("Authorization", "Bearer " + elderToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("requestId", UUID.randomUUID())))).andExpect(status().isConflict());
    }

    JsonNode medication(String token, java.time.LocalDate start) throws Exception {
        var result = mvc.perform(post("/api/medications").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("elderlyId", elder.getId(), "name", "Synthetic medication", "dosage", "synthetic unit", "startDate", start.toString(), "reminderTimes", java.util.List.of("23:59:00"), "timeZone", "Asia/Ho_Chi_Minh"))))
                .andExpect(status().isOk()).andReturn();
        return data(result.getResponse().getContentAsString());
    }

    @Test
    void recurringDosesAndQuartzJobsPersistAndReconcileWithoutDuplication() throws Exception {
        var med = medication(caregiverToken, java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1));
        Long id = med.path("id").asLong();
        var initial = doses.findByMedicationId(id);
        assertTrue(initial.size() >= 6);
        var dose = initial.getFirst();
        assertTrue(scheduler.getMetaData().isJobStoreSupportsPersistence());
        var key = new org.quartz.JobKey(dose.getOccurrenceId(), "medication");
        assertTrue(scheduler.checkExists(key));
        assertTrue(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_JOB_DETAILS WHERE JOB_NAME=?", Integer.class, dose.getOccurrenceId()) > 0);
        scheduler.deleteJob(key); // Simulate an interrupted reconciliation after data commit.
        reminders.materialize(id);
        reminders.materialize(id);
        assertEquals(initial.size(), doses.findByMedicationId(id).size());
        assertTrue(scheduler.checkExists(key));
        mvc.perform(delete("/api/medications/" + id).header("Authorization", "Bearer " + caregiverToken)).andExpect(status().isOk());
        assertFalse(scheduler.checkExists(key));
        assertTrue(doses.findByMedicationId(id).stream().allMatch(com.mimamori.medication.entity.MedicationLog::isCanceled));
    }

    @Test
    void confirmationIsIdempotentAndRejectsInvalidTransitions() throws Exception {
        var med = medication(caregiverToken, java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        Long id = med.path("id").asLong();
        var dose = doses.findByMedicationId(id).getFirst();
        String path = "/api/medications/logs/" + dose.getId() + "/confirm";
        mvc.perform(post(path).header("Authorization", "Bearer " + outsiderToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"TAKEN\"}")).andExpect(status().isForbidden());
        mvc.perform(post(path).header("Authorization", "Bearer " + elderToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PENDING\"}")).andExpect(status().isBadRequest());
        var first = mvc.perform(post(path).header("Authorization", "Bearer " + elderToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"TAKEN\"}")).andExpect(status().isOk()).andReturn();
        var second = mvc.perform(post(path).header("Authorization", "Bearer " + elderToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"TAKEN\"}")).andExpect(status().isOk()).andReturn();
        assertEquals(data(first.getResponse().getContentAsString()).path("confirmedAt"), data(second.getResponse().getContentAsString()).path("confirmedAt"));
        mvc.perform(post(path).header("Authorization", "Bearer " + elderToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"SKIPPED\"}")).andExpect(status().isConflict());
        assertFalse(scheduler.checkExists(new org.quartz.JobKey(dose.getOccurrenceId(), "medication")));
    }

    @Test
    void reminderFireDeduplicatesAndNeverConfirmsTheDose() throws Exception {
        var med = medication(caregiverToken, java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        var dose = doses.findByMedicationId(med.path("id").asLong()).getFirst();
        jdbc.update("UPDATE medication_logs SET scheduled_at=? WHERE id=?",java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(10)),dose.getId());
        reminders.fire(dose.getOccurrenceId()); reminders.fire(dose.getOccurrenceId());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE event_key=?",Integer.class, elder.getId()+":dose:"+dose.getOccurrenceId()));
        var saved = doses.findById(dose.getId()).orElseThrow();
        assertEquals(com.mimamori.medication.entity.MedicationStatus.PENDING, saved.getStatus());
        assertNull(saved.getConfirmedAt());
    }

    @Test
    void pushOutboxRetriesOnlyUndeliveredDevicesWithRoutingOnlyPayloads() throws Exception {
        String device = UUID.randomUUID().toString();
        String syntheticToken = "synthetic-push-token-" + device;
        mvc.perform(put("/api/devices/"+device).header("Authorization","Bearer "+caregiverToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("platform","android","token",syntheticToken)))).andExpect(status().isOk());
        mvc.perform(post("/api/emergencies").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("requestId",UUID.randomUUID())))).andExpect(status().isOk());
        org.mockito.Mockito.when(push.send(org.mockito.ArgumentMatchers.eq(syntheticToken),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn(com.mimamori.notification.service.PushGateway.Result.RETRY,com.mimamori.notification.service.PushGateway.Result.ACCEPTED);
        dispatcher.dispatch();
        assertEquals("RETRY",jdbc.queryForObject("SELECT status FROM notification_deliveries WHERE device_id=?",String.class,device));
        jdbc.update("UPDATE notification_deliveries SET next_attempt_at=NULL WHERE device_id=?",device);
        jdbc.update("UPDATE notifications SET next_attempt_at=NULL WHERE user_id=?",caregiver.getId());
        dispatcher.dispatch(); dispatcher.dispatch();
        assertEquals("ACCEPTED",jdbc.queryForObject("SELECT status FROM notification_deliveries WHERE device_id=?",String.class,device));
        assertEquals(2,jdbc.queryForObject("SELECT attempts FROM notification_deliveries WHERE device_id=?",Integer.class,device));
        var captor = org.mockito.ArgumentCaptor.forClass(Map.class);
        org.mockito.Mockito.verify(push,org.mockito.Mockito.times(2)).send(org.mockito.ArgumentMatchers.eq(syntheticToken),org.mockito.ArgumentMatchers.anyString(),captor.capture());
        assertEquals(caregiver.getId().toString(),captor.getValue().get("ownerId"));
        assertFalse(captor.getValue().containsKey("description"));
        assertFalse(captor.getValue().containsKey("medicationName"));
    }

    @Test
    void newFamilyLinksRequireElderlyConsentBeforeAnyCareDataAccess() throws Exception {
        var result=mvc.perform(post("/api/family/link").header("Authorization","Bearer "+outsiderToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("elderlyUsername",elder.getUsername()))))
                .andExpect(status().isOk()).andReturn();
        var link=data(result.getResponse().getContentAsString());
        assertEquals("PENDING",link.path("status").asText());
        assertEquals("",link.path("member").path("email").asText());
        mvc.perform(get("/api/medications?elderlyId="+elder.getId()).header("Authorization","Bearer "+outsiderToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/dashboard/overview?elderlyId="+elder.getId()).header("Authorization","Bearer "+outsiderToken)).andExpect(status().isForbidden());
        String accept="/api/family/link/"+link.path("relationshipId").asLong()+"/accept";
        mvc.perform(put(accept).header("Authorization","Bearer "+outsiderToken)).andExpect(status().isForbidden());
        mvc.perform(put(accept).header("Authorization","Bearer "+elderToken)).andExpect(status().isOk());
        mvc.perform(get("/api/medications?elderlyId="+elder.getId()).header("Authorization","Bearer "+outsiderToken)).andExpect(status().isOk());
    }

    @Test
    void companionRetriesReuseMessagesAndNeverExposeUnlinkedHistory() throws Exception {
        var active=mvc.perform(get("/api/conversations/active").header("Authorization","Bearer "+elderToken)).andExpect(status().isOk()).andReturn();
        long conversation=data(active.getResponse().getContentAsString()).path("id").asLong();
        String request=body(Map.of("content","こんにちは", "requestId",UUID.randomUUID()));
        var first=mvc.perform(post("/api/conversations/"+conversation+"/messages").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk()).andReturn();
        var repeat=mvc.perform(post("/api/conversations/"+conversation+"/messages").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk()).andReturn();
        assertEquals(data(first.getResponse().getContentAsString()).path("id"),data(repeat.getResponse().getContentAsString()).path("id"));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=?",Integer.class,conversation));
        mvc.perform(get("/api/conversations/"+conversation+"/messages").header("Authorization","Bearer "+outsiderToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/conversations/"+conversation+"/messages").header("Authorization","Bearer "+caregiverToken)).andExpect(status().isForbidden());
    }

    @Test
    void streamedReplyCompletesAndReplayDoesNotGenerateAgain() throws Exception {
        org.mockito.Mockito.doReturn(reactor.core.publisher.Flux.just("Xin ","chào"))
                .when(companion).streamCompanionReply(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList());
        long id=data(mvc.perform(get("/api/conversations/active").header("Authorization","Bearer "+elderToken)).andReturn().getResponse().getContentAsString()).path("id").asLong();
        String request=body(Map.of("content","Xin chào", "requestId",UUID.randomUUID()));
        for(int attempt=0;attempt<2;attempt++){
            var pending=mvc.perform(post("/api/conversations/"+id+"/messages/stream").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON).content(request))
                    .andExpect(request().asyncStarted()).andReturn();
            pending.getAsyncResult(5000);
            mvc.perform(asyncDispatch(pending)).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("event:done")))
                    .andExpect(result -> assertTrue(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8).contains("Xin chào")));
        }
        org.mockito.Mockito.verify(companion,org.mockito.Mockito.times(1)).streamCompanionReply(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=?",Integer.class,id));
    }

    @Test
    void failedStreamDoesNotPersistPartialReplyAndSameRequestCanRetry() throws Exception {
        org.mockito.Mockito.doReturn(reactor.core.publisher.Flux.concat(reactor.core.publisher.Flux.just("Partial"),reactor.core.publisher.Flux.error(new IllegalStateException("synthetic failure"))))
                .when(companion).streamCompanionReply(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList());
        long id=data(mvc.perform(get("/api/conversations/active").header("Authorization","Bearer "+elderToken)).andReturn().getResponse().getContentAsString()).path("id").asLong();
        String request=body(Map.of("content","Hello", "requestId",UUID.randomUUID()));
        var pending=mvc.perform(post("/api/conversations/"+id+"/messages/stream").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON).content(request)).andReturn();
        pending.getAsyncResult(5000);
        mvc.perform(asyncDispatch(pending)).andExpect(content().string(org.hamcrest.Matchers.containsString("event:error")));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=?",Integer.class,id));
        org.mockito.Mockito.doReturn(reactor.core.publisher.Flux.just("Recovered"))
                .when(companion).streamCompanionReply(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList());
        var retry=mvc.perform(post("/api/conversations/"+id+"/messages/stream").header("Authorization","Bearer "+elderToken).contentType(MediaType.APPLICATION_JSON).content(request)).andReturn();
        retry.getAsyncResult(5000);mvc.perform(asyncDispatch(retry)).andExpect(content().string(org.hamcrest.Matchers.containsString("event:done")));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=?",Integer.class,id));
    }

    @Test
    void publicApiContractContainsMobileBoundaries() throws Exception {
        var response=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var contract=json.readTree(response);
        for(String path:java.util.List.of("/api/auth/refresh","/api/emergencies","/api/reminders/upcoming","/api/conversations/{id}/messages/stream","/api/devices/{id}/mirrors"))assertTrue(contract.path("paths").has(path),path);
        assertTrue(contract.path("components").path("schemas").path("MedicationLogDto").path("properties").has("occurrenceId"));
        String output=System.getenv("OPENAPI_EXPORT_PATH");
        if(output!=null){var destination=java.nio.file.Path.of(output);java.nio.file.Files.createDirectories(destination.getParent());java.nio.file.Files.writeString(destination,json.writerWithDefaultPrettyPrinter().writeValueAsString(contract)+"\n");}
    }

    @Test
    void emptyMedicationDashboardNeverReportsPerfectAdherence() throws Exception {
        var result=mvc.perform(get("/api/dashboard/overview?elderlyId="+elder.getId()).header("Authorization","Bearer "+caregiverToken))
                .andExpect(status().isOk()).andReturn();
        var dashboard=data(result.getResponse().getContentAsString());
        assertTrue(dashboard.path("todayMedications").isEmpty());
        assertTrue(dashboard.path("medicationAdherence").isNull());
        assertTrue(dashboard.path("recentSummary").path("medicationAdherenceRate").isNull());
    }

    @Test
    void profileValidatesPartialUpdatesWithoutAllowingRoleChanges() throws Exception {
        for (var update : java.util.List.of(Map.of("fullName", "   "), Map.of("languagePreference", "unsupported"), Map.of("phone", "x".repeat(31)))) {
            mvc.perform(put("/api/users/me").header("Authorization", "Bearer " + elderToken)
                    .contentType(MediaType.APPLICATION_JSON).content(body(update))).andExpect(status().isBadRequest());
        }
        mvc.perform(put("/api/users/me").header("Authorization", "Bearer " + elderToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"languagePreference\":\"ja\",\"phone\":\"\",\"role\":\"CAREGIVER\"}"))
                .andExpect(status().isOk());
        var saved = users.findById(elder.getId()).orElseThrow();
        assertEquals(UserRole.ELDERLY, saved.getRole());
        assertEquals("ja", saved.getLanguagePreference());
        assertEquals("", saved.getPhone());
    }
}
