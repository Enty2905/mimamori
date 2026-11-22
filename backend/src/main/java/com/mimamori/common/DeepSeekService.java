package com.mimamori.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeepSeekService {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);
    private static final int MAX_HISTORY_MESSAGES = 6;

    private final RestClient restClient;
    private final boolean enabled;
    private final boolean thinkingEnabled;
    private final ObjectMapper objectMapper;

    @Autowired
    public DeepSeekService(
            @Value("${mimamori.deepseek.url:http://localhost:8001}") String baseUrl,
            @Value("${mimamori.deepseek.enabled:true}") boolean enabled,
            @Value("${mimamori.deepseek.thinking-enabled:false}") boolean thinkingEnabled,
            @Value("${mimamori.deepseek.read-timeout-seconds:65}") long readTimeoutSeconds,
            ObjectMapper objectMapper) {
        this(buildDefaultRestClient(baseUrl, readTimeoutSeconds), enabled, thinkingEnabled, objectMapper);
    }

    DeepSeekService(
            RestClient restClient,
            boolean enabled,
            boolean thinkingEnabled,
            ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.enabled = enabled;
        this.thinkingEnabled = thinkingEnabled;
        this.objectMapper = objectMapper;
    }

    private static RestClient buildDefaultRestClient(String baseUrl, long readTimeoutSeconds) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(Math.max(15, readTimeoutSeconds)));
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Generate an empathetic, warm response for the elderly user using the local DeepSeek proxy.
     * Returns null when disabled, invalid input, or proxy error so callers can fall back to Groq.
     */
    public String generateCompanionReply(String userMessage, String elderlyName, List<Map<String, String>> history) {
        if (!enabled || userMessage == null || userMessage.isBlank()) {
            return null;
        }

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
                "3. AN TOÀN Y TẾ KHẨN CẤP (ƯU TIÊN CAO NHẤT): Nếu người dùng nhắc tới các dấu hiệu nguy hiểm như đau ngực, khó thở, ngất, chóng mặt dữ dội hoặc té ngã:\n" +
                "   - Luôn ưu tiên khuyên cụ ngồi hoặc nằm yên ở nơi an toàn, gọi ngay cấp cứu 115 hoặc báo cho con cháu / người thân hỗ trợ ngay lập tức.\n" +
                "   - TUYỆT ĐỐI KHÔNG tự ý chẩn đoán bệnh hay kê đơn thuốc.\n" +
                "4. Trả lời súc tích, tự nhiên, câu từ ấm áp, thuần Việt, tuyệt đối không lặp lại máy móc các câu nhắc nhở nếu không phù hợp câu hỏi.\n" +
                "5. Độ dài lý tưởng: 2 đến 4 câu văn ngắn gọn, dễ đọc, mang lại niềm vui và sự an tâm.",
                name
        );

        String messagePayload = buildMessageWithHistory(userMessage, history);
        String reply = callDeepSeek(messagePayload, systemPrompt);
        if (reply != null) {
            log.info("DeepSeek companion reply succeeded (thinkingEnabled={})", thinkingEnabled);
            return reply;
        }
        log.warn("DeepSeek companion reply failed or returned empty; caller should fall back");
        return null;
    }

    /**
     * Generate caring analysis feedback for daily check-in using the local DeepSeek proxy.
     * Returns null when disabled or on failure so callers can fall back to Groq.
     */
    public String analyzeCheckIn(String mood, String physicalHealth, String sleepQuality, String appetite, String notes) {
        if (!enabled) {
            return null;
        }

        String systemPrompt = "Bạn là trợ lý y tế gia đình Mimamori AI, ân cần động viên sức khỏe người cao tuổi.";
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

        String reply = callDeepSeek(prompt, systemPrompt);
        if (reply != null) {
            log.info("DeepSeek check-in analysis succeeded (thinkingEnabled={})", thinkingEnabled);
            return reply;
        }
        log.warn("DeepSeek check-in analysis failed or returned empty; caller should fall back");
        return null;
    }

    /**
     * Read and explain a medicine box, blister pack, or prescription image in warm, elder-friendly Vietnamese
     * using DeepSeek Web Vision. Returns null when disabled, invalid input, or proxy error.
     */
    public String analyzeMedicineImage(
            String question,
            String elderlyName,
            String imageBase64,
            String mimeType,
            List<Map<String, String>> history) {
        if (!enabled || imageBase64 == null || imageBase64.isBlank()) {
            return null;
        }

        String name = (elderlyName != null && !elderlyName.isBlank()) ? elderlyName : "ông/bà";
        String userQuestion = (question != null && !question.isBlank())
                ? question.trim()
                : "Đây là thuốc gì? Công dụng, liều dùng và lưu ý an toàn như thế nào?";

        String systemPrompt = String.format(
                "Bạn là Mimamori AI - trợ lý đọc nhãn thuốc và chăm sóc sức khỏe ấm áp, lễ phép dành cho người cao tuổi Việt Nam.\n" +
                "Bạn đang hỗ trợ %s xem ảnh hộp thuốc, vỉ thuốc hoặc đơn thuốc (có thể in chữ tiếng Anh).\n" +
                "QUY TẮC BẮT BUỘC VỀ ĐỘ CHÍNH XÁC & AN TOÀN:\n" +
                "1. CHỈ đọc và nêu tên thuốc, hoạt chất, hàm lượng/liều lượng, cách dùng và cảnh báo mà bạn NHÌN THẤY RÕ RÀNG trong ảnh.\n" +
                "2. TUYỆT ĐỐI KHÔNG tự ý suy đoán, bịa đặt hoặc điền thêm tên thuốc hay hàm lượng khi chữ bị mờ, khuất, lóa sáng hoặc không đọc được.\n" +
                "3. Nếu ảnh quá mờ, bị cắt chữ hoặc không chắc chắn về tên thuốc: hãy nói thật rõ phần nào nhìn thấy, phần nào bị mờ không đọc được, và nhẹ nhàng khuyên bác chụp lại ảnh rõ nét hơn dưới ánh sáng tốt hoặc đưa người thân/bác sĩ/dược sĩ kiểm tra trực tiếp.\n" +
                "4. Nếu đọc được thuốc rõ ràng, hãy giải thích bằng tiếng Việt giản dị, ấm áp (xưng 'cháu', gọi 'bác'/'cụ'), bố cục ngắn gọn dễ đọc gồm:\n" +
                "   - Tên thuốc (nêu tên tiếng Anh trên vỏ nếu có + hoạt chất) và hàm lượng.\n" +
                "   - Công dụng chính (giải thích dễ hiểu).\n" +
                "   - Cách dùng tham khảo ghi trên nhãn/đơn (nếu thấy trong ảnh) và các lưu ý/cảnh báo quan trọng.\n" +
                "   - Giải đáp trực tiếp câu hỏi kèm theo của bác (nếu có).\n" +
                "5. AN TOÀN Y TẾ: Luôn nhắc bác không tự ý tăng/giảm liều, uống đúng theo chỉ dẫn của bác sĩ/dược sĩ hoặc hỏi con cháu trước khi dùng; nếu có dấu hiệu bất thường như khó thở, đau ngực, ngất, phát ban thì ngừng dùng và báo ngay người thân hoặc gọi cấp cứu 115.",
                name
        );

        String messagePayload = buildMessageWithHistory(userQuestion, history);
        String reply = callDeepSeekVision(messagePayload, systemPrompt, imageBase64, mimeType);
        if (reply != null) {
            log.info("DeepSeek medicine vision reply succeeded");
            return reply;
        }
        log.warn("DeepSeek medicine vision reply failed or returned empty");
        return null;
    }

    private String buildMessageWithHistory(String userMessage, List<Map<String, String>> history) {
        if (history == null || history.isEmpty()) {
            return userMessage;
        }
        StringBuilder sb = new StringBuilder("Ngữ cảnh hội thoại gần đây:\n");
        int start = Math.max(0, history.size() - MAX_HISTORY_MESSAGES);
        boolean hasEntries = false;
        for (int i = start; i < history.size(); i++) {
            Map<String, String> entry = history.get(i);
            if (entry == null) {
                continue;
            }
            String content = entry.get("content");
            if (content == null || content.isBlank()) {
                continue;
            }
            String role = "user".equalsIgnoreCase(entry.get("role")) ? "Bác" : "Mimamori";
            sb.append("- ").append(role).append(": ").append(content.trim()).append('\n');
            hasEntries = true;
        }
        if (!hasEntries) {
            return userMessage;
        }
        sb.append("\nTin nhắn mới nhất của người cao tuổi: ").append(userMessage);
        return sb.toString();
    }

    private String callDeepSeek(String message, String systemPrompt) {
        return callDeepSeekEndpoint("/chat", message, systemPrompt, null, null);
    }

    private String callDeepSeekVision(String message, String systemPrompt, String imageBase64, String mimeType) {
        return callDeepSeekEndpoint("/chat-vision", message, systemPrompt, imageBase64, mimeType);
    }

    private String callDeepSeekEndpoint(
            String uri,
            String message,
            String systemPrompt,
            String imageBase64,
            String mimeType) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("message", message);
            requestBody.put("system_prompt", systemPrompt);
            requestBody.put("thinking_enabled", thinkingEnabled);
            requestBody.put("new_chat", false);
            if (imageBase64 != null && !imageBase64.isBlank()) {
                requestBody.put("image_base64", imageBase64);
                if (mimeType != null && !mimeType.isBlank()) {
                    requestBody.put("image_mime_type", mimeType);
                }
            }

            String responseJson = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            if (responseJson != null && !responseJson.isBlank()) {
                JsonNode root = objectMapper.readTree(responseJson);
                String content = root.path("response").asText("");
                if (!content.isBlank()) {
                    return content.trim();
                }
            }
        } catch (Exception e) {
            log.warn("DeepSeek proxy call ({}) failed: {}", uri, e.getMessage());
        }
        return null;
    }
}
