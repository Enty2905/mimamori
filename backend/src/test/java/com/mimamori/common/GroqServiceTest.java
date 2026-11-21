package com.mimamori.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GroqServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void systemPromptIncludesEmergencySafetyAndNoDiagnosisRule() throws Exception {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GroqService groqService = new GroqService(
                builder.build(),
                "test-key",
                "openai/gpt-oss-120b",
                "openai/gpt-oss-20b",
                objectMapper
        );

        server.expect(requestTo("https://api.groq.com/openai/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(request -> {
                    JsonNode root = objectMapper.readTree(request.getBody().toString());
                    String systemPrompt = root.path("messages").get(0).path("content").asText();
                    assertTrue(systemPrompt.contains("115"));
                    assertTrue(systemPrompt.contains("đau ngực"));
                    assertTrue(systemPrompt.contains("khó thở"));
                    assertTrue(systemPrompt.contains("ngất"));
                    assertTrue(systemPrompt.contains("chóng mặt"));
                    assertTrue(systemPrompt.contains("té ngã"));
                    assertTrue(systemPrompt.contains("KHÔNG tự ý chẩn đoán bệnh"));
                })
                .andRespond(withSuccess(
                        "{\"choices\":[{\"message\":{\"content\":\"Dạ cụ gọi 115 ngay nhé.\"}}]}",
                        MediaType.APPLICATION_JSON
                ));

        String reply = groqService.generateCompanionReply("Chào cháu", "Cụ Ba", List.of());
        assertEquals("Dạ cụ gọi 115 ngay nhé.", reply);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Tôi bị đau ngực quá",
            "Bác thấy khó thở lắm",
            "Hồi nãy tôi vừa bị ngất",
            "Tôi chóng mặt không đứng vững",
            "Bà vừa bị té ngã ở phòng khách"
    })
    void heuristicFallbackPrioritizesEmergency115AndNeverDiagnoses(String emergencyMessage) {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GroqService groqService = new GroqService(
                builder.build(),
                "test-key",
                "openai/gpt-oss-120b",
                "openai/gpt-oss-20b",
                objectMapper
        );

        server.expect(times(2), requestTo("https://api.groq.com/openai/v1/chat/completions"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        String reply = groqService.generateCompanionReply(emergencyMessage, "Cụ Ba", List.of());
        assertNotNull(reply);
        assertTrue(reply.contains("115"), "Expected 115 emergency guidance for: " + emergencyMessage);
        assertTrue(reply.contains("con cháu") || reply.contains("người thân"));
        assertTrue(reply.contains("không thể tự chẩn đoán bệnh"));
        server.verify();
    }
}
