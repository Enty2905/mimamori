package com.mimamori.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GroqService {

    private static final Logger log = LoggerFactory.getLogger(GroqService.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String primaryModel;
    private final String fallbackModel;

    public GroqService(
            @Value("${mimamori.groq.base-url:https://api.groq.com/openai/v1}") String baseUrl,
            @Value("${mimamori.groq.api-key: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}") String apiKey,
            @Value("${mimamori.groq.model:openai/gpt-oss-120b}") String primaryModel,
            @Value("${mimamori.groq.fallback-model:openai/gpt-oss-20b}") String fallbackModel,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.primaryModel = primaryModel;
        this.fallbackModel = fallbackModel;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Generate an empathetic, warm response for the elderly user using Groq LLM.
     */
    public String generateCompanionReply(String userMessage, String elderlyName, List<Map<String, String>> history) {
        String name = (elderlyName != null && !elderlyName.isBlank()) ? elderlyName : "ông/bà";

        String systemPrompt = String.format(
                "Bạn là Mimamori AI - bạn đồng hành và trợ lý ảo AI thông minh, ấm áp, thấu hiểu và lễ phép dành cho người cao tuổi Việt Nam.\n" +
                "Bạn đang trò chuyện thân tình cùng %s.\n" +
                "Quy tắc phản hồi:\n" +
                "1. Luôn xưng là 'cháu' và gọi người dùng là 'cụ', 'bác' hoặc 'ông/bà' một cách kính trọng, yêu thương như con cháu ruột.\n" +
                "2. TRẢ LỜI ĐÚNG TRỌNG TÂM câu hỏi hoặc yêu cầu của người dùng:\n" +
                "   - Nếu người dùng yêu cầu kể chuyện vui / thơ ca: hãy kể một câu chuyện vui hóm hỉnh, nhẹ nhàng, dí dỏm hoặc bài thơ ngắn ý nghĩa.\n" +
                "   - Nếu người dùng hỏi thông tin (thời tiết, món ăn ngon, giấc ngủ...): trả lời rõ ràng, thiết thực, có ích cho người lớn tuổi.\n" +
                "   - Nếu người dùng tâm sự về buồn chán, cô đơn, mệt mỏi hay đau nhức: lắng nghe thấu hiểu sâu sắc, vỗ về và khuyên cụ báo ngay cho con cháu / người thân hỗ trợ.\n" +
                "3. Trả lời súc tích, tự nhiên, câu từ ấm áp, thuần Việt, tuyệt đối không lặp lại máy móc các câu nhắc nhở nếu không phù hợp câu hỏi.\n" +
                "4. Độ dài lý tưởng: 2 đến 4 câu văn ngắn gọn, dễ đọc, mang lại niềm vui và sự an tâm.",
                name
        );

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        if (history != null && !history.isEmpty()) {
            int start = Math.max(0, history.size() - 6);
            for (int i = start; i < history.size(); i++) {
                messages.add(history.get(i));
            }
        }

        messages.add(Map.of("role", "user", "content", userMessage));

        String reply = callGroq(primaryModel, messages, 250);
        if (reply == null || reply.isBlank()) {
            reply = callGroq(fallbackModel, messages, 250);
        }

        if (reply != null && !reply.isBlank()) {
            return reply.trim();
        }

        // Rule-based fallback if network/rate limit issues
        return getHeuristicFallback(userMessage);
    }

    /**
     * Generate caring analysis feedback for daily check-in.
     */
    public String analyzeCheckIn(String mood, String physicalHealth, String sleepQuality, String appetite, String notes) {
        String prompt = String.format(
                "Người cao tuổi vừa hoàn thành điểm danh sức khỏe hôm nay:\n" +
                "- Tâm trạng: %s\n" +
                "- Thể trạng: %s\n" +
                "- Giấc ngủ: %s\n" +
                "- Ăn uống: %s\n" +
                "- Ghi chú thêm: %s\n\n" +
                "Hãy viết một lời động viên và căn dặn sức khỏe thật ấm áp, ngắn gọn đúng 1 đến 2 câu bằng tiếng Việt (xưng cháu, gọi bác).",
                mood, physicalHealth, sleepQuality, appetite, (notes != null ? notes : "Không có")
        );

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", "Bạn là trợ lý y tế gia đình Mimamori AI, ân cần động viên sức khỏe người cao tuổi."),
                Map.of("role", "user", "content", prompt)
        );

        String reply = callGroq(fallbackModel, messages, 150);
        if (reply != null && !reply.isBlank()) {
            return reply.trim();
        }

        return "Cháu mừng khi nhận được cập nhật sức khỏe hôm nay của bác! Bác nhớ giữ ấm cơ thể, uống nhiều nước ấm và nghỉ ngơi điều độ nhé ạ.";
    }

    private String callGroq(String model, List<Map<String, String>> messages, int maxTokens) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("messages", messages);
            requestBody.put("max_tokens", maxTokens);
            requestBody.put("temperature", 0.7);

            String responseJson = restClient.post()
                    .uri("/chat/completions")
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            if (responseJson != null) {
                JsonNode root = objectMapper.readTree(responseJson);
                JsonNode choices = root.path("choices");
                if (choices.isArray() && !choices.isEmpty()) {
                    JsonNode messageNode = choices.get(0).path("message");
                    String content = messageNode.path("content").asText();
                    if (content != null && !content.isBlank()) {
                        return content;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Groq API call with model {} failed: {}", model, e.getMessage());
        }
        return null;
    }

    private String getHeuristicFallback(String userMessage) {
        String lower = userMessage.toLowerCase();
        if (lower.contains("chuyện vui") || lower.contains("kể chuyện") || lower.contains("hài")) {
            return "Dạ cháu kể cụ nghe mẩu chuyện vui nhé: Có một cụ ông đi đo mắt, bác sĩ ân cần hỏi: 'Cụ nhìn bảng chữ này có rõ không?'. Cụ mỉm cười hiền từ: 'Chữ thì hơi mờ, nhưng bác sĩ đứng bên cạnh thì cụ thấy rất tươi tỉnh!'. Chúc cụ luôn vui tươi, yêu đời mỗi ngày ạ!";
        } else if (lower.contains("mệt") || lower.contains("đau") || lower.contains("buồn") || lower.contains("sốt")) {
            return "Cháu nghe thấy cụ đang không được khỏe. Cụ nhớ ngồi nghỉ ngơi, uống một cốc nước ấm nhé. Cụ có cần cháu nhắn cho con cháu sang bên cụ ngay không ạ?";
        } else if (lower.contains("thuốc") || lower.contains("uống")) {
            return "Dạ cụ nhớ uống thuốc đúng giờ và theo đúng liều lượng bác sĩ dặn nhé! Cụ đã uống cữ thuốc hôm nay chưa ạ?";
        } else if (lower.contains("thời tiết")) {
            return "Dạ tiết trời hôm nay khá dễ chịu, cụ nhớ chú ý giữ ấm cổ ngực vào sáng sớm và chiều tối khi ra ngoài dạo bước nhé ạ!";
        } else if (lower.contains("chào") || lower.contains("khỏe") || lower.contains("vui")) {
            return "Dạ cháu kính chào cụ! Thấy cụ luôn vui khỏe, an yên là niềm vui lớn nhất của con cháu trong nhà đấy ạ!";
        }
        return "Dạ cháu luôn ở đây lắng nghe và trò chuyện cùng cụ. Cụ muốn cháu kể chuyện, chia sẻ món ăn bổ dưỡng hay điều gì cùng cụ không ạ?";
    }
}

