package com.mimamori.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DeepSeekServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void generateCompanionReplyCallsChatEndpointWithSafetySystemPromptAndHistory() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DeepSeekService deepSeekService = new DeepSeekService(
                builder.build(),
                true,
                false,
                objectMapper
        );

        server.expect(requestTo("http://localhost:8001/chat"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(request -> {
                    JsonNode root = objectMapper.readTree(request.getBody().toString());
                    String systemPrompt = root.path("system_prompt").asText();
                    String message = root.path("message").asText();

                    assertTrue(systemPrompt.contains("115"));
                    assertTrue(systemPrompt.contains("đau ngực"));
                    assertTrue(systemPrompt.contains("khó thở"));
                    assertTrue(systemPrompt.contains("ngất"));
                    assertTrue(systemPrompt.contains("chóng mặt"));
                    assertTrue(systemPrompt.contains("té ngã"));
                    assertTrue(systemPrompt.contains("KHÔNG tự ý chẩn đoán bệnh"));
                    assertTrue(systemPrompt.contains("Cụ Ba"));

                    assertTrue(message.contains("Chào cháu"));
                    assertTrue(message.contains("Hôm nay trời mát quá"));
                    assertFalse(root.path("thinking_enabled").asBoolean(true));
                    assertFalse(root.path("new_chat").asBoolean(true));
                })
                .andRespond(withSuccess(
                        "{\"response\":\"Dạ cháu chào cụ Ba ạ! Trời mát cụ nhớ mặc thêm áo mỏng nhé ạ.\"}",
                        MediaType.APPLICATION_JSON
                ));

        List<Map<String, String>> history = List.of(
                Map.of("role", "user", "content", "Chào cháu")
        );
        String reply = deepSeekService.generateCompanionReply("Hôm nay trời mát quá", "Cụ Ba", history);

        assertEquals("Dạ cháu chào cụ Ba ạ! Trời mát cụ nhớ mặc thêm áo mỏng nhé ạ.", reply);
        server.verify();
    }

    @Test
    void generateCompanionReplyReturnsNullWhenProxyReturns5xxOrEmpty() {
        RestClient.Builder builder5xx = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer server5xx = MockRestServiceServer.bindTo(builder5xx).build();
        DeepSeekService service5xx = new DeepSeekService(
                builder5xx.build(),
                true,
                false,
                objectMapper
        );

        server5xx.expect(requestTo("http://localhost:8001/chat"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertNull(service5xx.generateCompanionReply("Chào cháu", "Cụ Ba", List.of()));
        server5xx.verify();

        RestClient.Builder builderEmpty = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer serverEmpty = MockRestServiceServer.bindTo(builderEmpty).build();
        DeepSeekService serviceEmpty = new DeepSeekService(
                builderEmpty.build(),
                true,
                false,
                objectMapper
        );

        serverEmpty.expect(requestTo("http://localhost:8001/chat"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"response\":\"   \"}", MediaType.APPLICATION_JSON));

        assertNull(serviceEmpty.generateCompanionReply("Chào cháu", "Cụ Ba", List.of()));
        serverEmpty.verify();
    }

    @Test
    void analyzeCheckInCallsChatEndpointAndReturnsTrimmedResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DeepSeekService deepSeekService = new DeepSeekService(
                builder.build(),
                true,
                false,
                objectMapper
        );

        server.expect(requestTo("http://localhost:8001/chat"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(request -> {
                    JsonNode root = objectMapper.readTree(request.getBody().toString());
                    String systemPrompt = root.path("system_prompt").asText();
                    String message = root.path("message").asText();

                    assertTrue(systemPrompt.contains("Mimamori AI"));
                    assertTrue(message.contains("HAPPY"));
                    assertTrue(message.contains("GOOD"));
                    assertTrue(message.contains("DEEP"));
                    assertTrue(message.contains("NORMAL"));
                    assertTrue(message.contains("Đi dạo buổi sáng"));
                    assertFalse(root.path("thinking_enabled").asBoolean(true));
                    assertFalse(root.path("new_chat").asBoolean(true));
                })
                .andRespond(withSuccess(
                        "{\"response\":\"  Cháu rất vui khi thấy bác khỏe khoắn hôm nay ạ!  \"}",
                        MediaType.APPLICATION_JSON
                ));

        String analysis = deepSeekService.analyzeCheckIn("HAPPY", "GOOD", "DEEP", "NORMAL", "Đi dạo buổi sáng");
        assertEquals("Cháu rất vui khi thấy bác khỏe khoắn hôm nay ạ!", analysis);
        server.verify();
    }

    @Test
    void analyzeMedicineImageCallsChatVisionWithAntiHallucinationPromptAndBase64() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DeepSeekService deepSeekService = new DeepSeekService(
                builder.build(),
                true,
                false,
                objectMapper
        );

        server.expect(requestTo("http://localhost:8001/chat-vision"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(request -> {
                    JsonNode root = objectMapper.readTree(request.getBody().toString());
                    String systemPrompt = root.path("system_prompt").asText();
                    String message = root.path("message").asText();

                    assertEquals("iVBORw0KGgo=", root.path("image_base64").asText());
                    assertEquals("image/png", root.path("image_mime_type").asText());
                    assertTrue(systemPrompt.contains("TUYỆT ĐỐI KHÔNG tự ý suy đoán"));
                    assertTrue(systemPrompt.contains("115"));
                    assertTrue(systemPrompt.contains("Cụ Ba"));
                    assertTrue(message.contains("Thuốc này uống lúc nào"));
                    assertFalse(root.path("thinking_enabled").asBoolean(true));
                })
                .andRespond(withSuccess(
                        "{\"response\":\"Dạ đây là thuốc Paracetamol 500mg ạ.\"}",
                        MediaType.APPLICATION_JSON
                ));

        String reply = deepSeekService.analyzeMedicineImage(
                "Thuốc này uống lúc nào",
                "Cụ Ba",
                "iVBORw0KGgo=",
                "image/png",
                List.of()
        );
        assertEquals("Dạ đây là thuốc Paracetamol 500mg ạ.", reply);
        server.verify();
    }

    @Test
    void analyzeMedicineImageReturnsNullOnProxyFailureOrBlankImage() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8001");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DeepSeekService deepSeekService = new DeepSeekService(
                builder.build(),
                true,
                false,
                objectMapper
        );

        assertNull(deepSeekService.analyzeMedicineImage("Thuốc gì?", "Cụ Ba", "   ", "image/png", List.of()));

        server.expect(requestTo("http://localhost:8001/chat-vision"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertNull(deepSeekService.analyzeMedicineImage("Thuốc gì?", "Cụ Ba", "iVBORw0KGgo=", "image/png", List.of()));
        server.verify();
    }
}
