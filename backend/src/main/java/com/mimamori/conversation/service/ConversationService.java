package com.mimamori.conversation.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.DeepSeekService;
import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.ChatMessageDto;
import com.mimamori.conversation.dto.ChatMessageRequest;
import com.mimamori.conversation.dto.ConversationDto;
import com.mimamori.conversation.entity.ChatMessage;
import com.mimamori.conversation.entity.Conversation;
import com.mimamori.conversation.entity.MessageSender;
import com.mimamori.conversation.repository.ChatMessageRepository;
import com.mimamori.conversation.repository.ConversationRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Transactional
public class ConversationService {

    private static final Logger log = LoggerFactory.getLogger(ConversationService.class);

    static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    private static final int MAX_STORED_RAW_BASE64_LENGTH = 700_000;
    private static final int THUMBNAIL_MAX_DIMENSION = 480;
    private static final String DEFAULT_MEDICINE_QUESTION =
            "Đây là thuốc gì? Công dụng, liều dùng và lưu ý an toàn như thế nào?";
    private static final Set<String> ALLOWED_IMAGE_MIMES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif"
    );
    private static final Pattern DATA_URI_PATTERN =
            Pattern.compile("^data:([^;]+);base64,(.*)$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final RestClient restClient;
    private final GroqService groqService;
    private final DeepSeekService deepSeekService;

    public ConversationService(
            ConversationRepository conversationRepository,
            ChatMessageRepository messageRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            @Value("${mimamori.ai-service.url:http://localhost:8000}") String aiServiceUrl,
            GroqService groqService) {
        this(
                conversationRepository,
                messageRepository,
                userRepository,
                relationshipRepository,
                aiServiceUrl,
                groqService,
                null
        );
    }

    @Autowired
    public ConversationService(
            ConversationRepository conversationRepository,
            ChatMessageRepository messageRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            @Value("${mimamori.ai-service.url:http://localhost:8000}") String aiServiceUrl,
            GroqService groqService,
            @Autowired(required = false) DeepSeekService deepSeekService) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.groqService = groqService;
        this.deepSeekService = deepSeekService;
        this.restClient = RestClient.builder().baseUrl(aiServiceUrl).build();
    }

    @Transactional
    public ConversationDto getOrCreateActiveConversation(Long elderlyId) {
        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));

        Conversation conv = conversationRepository.findFirstByElderlyIdOrderByLastMessageAtDesc(elderlyId)
                .orElseGet(() -> {
                    Conversation newConv = new Conversation(elderly, "Trò chuyện cùng Mimamori AI");
                    newConv = conversationRepository.save(newConv);
                    // Add welcoming system message
                    ChatMessage welcomeMsg = new ChatMessage(
                            newConv,
                            MessageSender.AI,
                            "Cháu chào bác ạ! Hôm nay bác cảm thấy trong người thế nào ạ? Bác đã ăn cơm và uống thuốc chưa?"
                    );
                    messageRepository.save(welcomeMsg);
                    return newConv;
                });

        return ConversationDto.fromEntity(conv, true);
    }

    @Transactional
    public ChatMessageDto sendMessage(Long elderlyId, Long conversationId, ChatMessageRequest request) {
        if (request != null && request.hasImage()) {
            return sendMedicineImageMessage(
                    elderlyId,
                    conversationId,
                    request.getImageBase64(),
                    request.getMimeType(),
                    request.getContent()
            );
        }

        Conversation conv = requireOwnedConversation(elderlyId, conversationId);

        // 1. Save user message
        ChatMessage userMsg = new ChatMessage(conv, MessageSender.USER, request.getContent());
        userMsg = messageRepository.save(userMsg);

        // 2. Query AI response from DeepSeek / Groq LLM or internal AI service
        String aiReplyContent = fetchAiCompanionReply(conv, request.getContent());

        // 3. Save AI message
        ChatMessage aiMsg = new ChatMessage(conv, MessageSender.AI, aiReplyContent);
        aiMsg = messageRepository.save(aiMsg);

        conv.setLastMessageAt(Instant.now());
        conversationRepository.save(conv);

        return ChatMessageDto.fromEntity(aiMsg);
    }

    @Transactional
    public ChatMessageDto sendMedicineImageMessage(
            Long elderlyId,
            Long conversationId,
            MultipartFile imageFile,
            String rawQuestion) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new ApiException(400, "Vui lòng chọn hoặc chụp ảnh thuốc để cháu xem giúp bác nhé.");
        }
        if (imageFile.getSize() > MAX_IMAGE_BYTES) {
            throw new ApiException(413, "Ảnh vượt quá dung lượng tối đa 10MB. Bác vui lòng chọn ảnh nhẹ hơn nhé.");
        }
        byte[] bytes;
        try {
            bytes = imageFile.getBytes();
        } catch (IOException e) {
            throw new ApiException(400, "Không thể đọc dữ liệu ảnh. Bác vui lòng thử chụp hoặc chọn lại ảnh nhé.");
        }
        String base64 = Base64.getEncoder().encodeToString(bytes);
        String mimeType = resolveMultipartImageMime(imageFile.getContentType(), imageFile.getOriginalFilename());
        return sendMedicineImageMessage(elderlyId, conversationId, base64, mimeType, rawQuestion);
    }

    @Transactional
    public ChatMessageDto sendMedicineImageMessage(
            Long elderlyId,
            Long conversationId,
            String rawImageBase64,
            String rawMimeType,
            String rawQuestion) {
        Conversation conv = requireOwnedConversation(elderlyId, conversationId);
        ValidatedImage image = validateAndNormalizeImage(rawImageBase64, rawMimeType);
        String question = (rawQuestion != null && !rawQuestion.isBlank())
                ? rawQuestion.trim()
                : DEFAULT_MEDICINE_QUESTION;

        String aiReplyContent = fetchMedicineVisionReply(conv, question, image.cleanBase64(), image.mimeType());

        StoredThumbnail thumbnail = createThumbnailForStorage(image.bytes(), image.cleanBase64(), image.mimeType());
        ChatMessage userMsg = new ChatMessage(conv, MessageSender.USER, question);
        userMsg.setMessageType("MEDICINE_IMAGE");
        userMsg.setImageBase64(thumbnail.base64());
        userMsg.setImageMimeType(thumbnail.mimeType());
        messageRepository.save(userMsg);

        ChatMessage aiMsg = new ChatMessage(conv, MessageSender.AI, aiReplyContent);
        aiMsg.setMessageType("TEXT");
        aiMsg = messageRepository.save(aiMsg);

        conv.setLastMessageAt(Instant.now());
        conversationRepository.save(conv);

        return ChatMessageDto.fromEntity(aiMsg);
    }

    private Conversation requireOwnedConversation(Long elderlyId, Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ApiException(404, "Conversation not found"));

        if (!conv.getElderly().getId().equals(elderlyId)) {
            throw new ApiException(403, "You do not own this conversation");
        }
        return conv;
    }

    public List<ChatMessageDto> getMessages(Long currentUserId, Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ApiException(404, "Conversation not found"));

        Long ownerId = conv.getElderly().getId();
        if (!ownerId.equals(currentUserId)) {
            // Check if current user is linked caregiver with permission
            boolean hasPermission = relationshipRepository.findByCaregiverIdAndElderlyId(currentUserId, ownerId)
                    .map(rel -> Boolean.TRUE.equals(rel.getCanViewConversations()))
                    .orElse(false);

            if (!hasPermission) {
                throw new ApiException(403, "You do not have permission to view this conversation");
            }
        }

        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(ChatMessageDto::fromEntity)
                .collect(Collectors.toList());
    }

    private String fetchAiCompanionReply(Conversation conv, String userMessage) {
        List<ChatMessage> recentList = messageRepository.findByConversationIdOrderByCreatedAtAsc(conv.getId());
        List<Map<String, String>> history = new ArrayList<>();
        for (ChatMessage m : recentList) {
            String role = (m.getSender() == MessageSender.USER) ? "user" : "assistant";
            history.add(Map.of("role", role, "content", m.getContent()));
        }
        String name = (conv.getElderly() != null) ? conv.getElderly().getFullName() : "bác";

        // 1. Prefer DeepSeek proxy first when enabled and reachable
        if (deepSeekService != null && deepSeekService.isEnabled()) {
            try {
                String deepSeekReply = deepSeekService.generateCompanionReply(userMessage, name, history);
                if (deepSeekReply != null && !deepSeekReply.isBlank()) {
                    log.info("Companion reply served by provider=DeepSeek for conversationId={}", conv.getId());
                    return deepSeekReply;
                }
                log.info("DeepSeek unavailable/empty for conversationId={}, falling back to Groq", conv.getId());
            } catch (Exception e) {
                log.warn("DeepSeek error for conversationId={}, falling back to Groq: {}", conv.getId(), e.getMessage());
            }
        }

        // 2. Fall back to Groq AI with conversation history
        if (groqService != null) {
            try {
                String groqReply = groqService.generateCompanionReply(userMessage, name, history);
                if (groqReply != null && !groqReply.isBlank()) {
                    log.info("Companion reply served by provider=Groq for conversationId={}", conv.getId());
                    return groqReply;
                }
            } catch (Exception e) {
                log.warn("Groq error for conversationId={}, falling back to ai-service: {}", conv.getId(), e.getMessage());
            }
        }

        // 3. Try secondary internal AI service
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/api/companion/chat")
                    .body(Map.of("elderly_id", conv.getElderly().getId(), "message", userMessage))
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("reply")) {
                String aiServiceReply = (String) response.get("reply");
                if (aiServiceReply != null && !aiServiceReply.isBlank()) {
                    log.info("Companion reply served by provider=ai-service for conversationId={}", conv.getId());
                    return aiServiceReply;
                }
            }
        } catch (Exception e) {
            log.warn("Secondary ai-service error for conversationId={}, falling back to heuristic: {}", conv.getId(), e.getMessage());
        }

        // 4. Empathetic heuristic response when AI services are processing or offline
        log.info("Companion reply served by provider=heuristic for conversationId={}", conv.getId());
        String lower = userMessage.toLowerCase();
        if (lower.contains("đau ngực") || lower.contains("tức ngực")
                || lower.contains("khó thở")
                || lower.contains("ngất")
                || lower.contains("chóng mặt")
                || lower.contains("té ngã") || lower.contains("bị ngã")) {
            return "Dạ cháu rất lo cho sức khỏe của cụ lúc này! Cụ hãy ngồi hoặc nằm nghỉ yên tại chỗ an toàn, gọi ngay cấp cứu 115 hoặc nhờ người thân, con cháu hỗ trợ ngay lập tức nhé ạ. Cháu không thể tự chẩn đoán bệnh nên cụ cần được bác sĩ kiểm tra ngay ạ!";
        } else if (lower.contains("chuyện vui") || lower.contains("kể chuyện") || lower.contains("hài")) {
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

    private String fetchMedicineVisionReply(
            Conversation conv,
            String question,
            String cleanBase64,
            String mimeType) {
        List<ChatMessage> recentList = messageRepository.findByConversationIdOrderByCreatedAtAsc(conv.getId());
        List<Map<String, String>> history = new ArrayList<>();
        for (ChatMessage m : recentList) {
            String role = (m.getSender() == MessageSender.USER) ? "user" : "assistant";
            history.add(Map.of("role", role, "content", m.getContent()));
        }
        String name = (conv.getElderly() != null) ? conv.getElderly().getFullName() : "bác";

        if (deepSeekService != null && deepSeekService.isEnabled()) {
            try {
                String reply = deepSeekService.analyzeMedicineImage(question, name, cleanBase64, mimeType, history);
                if (reply != null && !reply.isBlank()) {
                    log.info("Medicine vision reply served by provider=DeepSeek for conversationId={}", conv.getId());
                    return reply;
                }
            } catch (Exception e) {
                log.warn("DeepSeek vision error for conversationId={}: {}", conv.getId(), e.getMessage());
            }
        }

        if (groqService != null && groqService.isVisionConfigured()) {
            try {
                String reply = groqService.analyzeMedicineImage(question, name, cleanBase64, mimeType);
                if (reply != null && !reply.isBlank()) {
                    log.info("Medicine vision reply served by provider=GroqVision for conversationId={}", conv.getId());
                    return reply;
                }
            } catch (Exception e) {
                log.warn("Groq vision error for conversationId={}: {}", conv.getId(), e.getMessage());
            }
        }

        throw new ApiException(
                503,
                "Hiện tại cháu chưa thể đọc được ảnh thuốc lúc này. Bác vui lòng thử chụp lại rõ nét hơn hoặc gửi lại sau ít phút, hoặc nhờ con cháu/dược sĩ xem giúp nhé ạ."
        );
    }

    private ValidatedImage validateAndNormalizeImage(String rawBase64, String rawMimeType) {
        if (rawBase64 == null || rawBase64.isBlank()) {
            throw new ApiException(400, "Vui lòng chọn hoặc chụp ảnh thuốc để cháu xem giúp bác nhé.");
        }

        String trimmed = rawBase64.trim();
        String mime = normalizeImageMime(rawMimeType);
        Matcher dataUriMatcher = DATA_URI_PATTERN.matcher(trimmed);
        if (dataUriMatcher.matches()) {
            if (mime == null) {
                mime = normalizeImageMime(dataUriMatcher.group(1));
            }
            trimmed = dataUriMatcher.group(2);
        }

        if (mime == null) {
            mime = "image/jpeg";
        }
        if (!ALLOWED_IMAGE_MIMES.contains(mime)) {
            throw new ApiException(400, "Định dạng ảnh không được hỗ trợ. Bác vui lòng chọn ảnh JPG, PNG hoặc WEBP nhé.");
        }

        String cleanBase64 = trimmed.replaceAll("\\s+", "");
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(cleanBase64);
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "Dữ liệu ảnh không hợp lệ. Bác vui lòng chụp hoặc chọn lại ảnh nhé.");
        }

        if (bytes.length == 0) {
            throw new ApiException(400, "Dữ liệu ảnh trống. Bác vui lòng chụp hoặc chọn lại ảnh nhé.");
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new ApiException(413, "Ảnh vượt quá dung lượng tối đa 10MB. Bác vui lòng chọn ảnh nhẹ hơn nhé.");
        }

        return new ValidatedImage(cleanBase64, mime, bytes);
    }

    private static String normalizeImageMime(String rawMime) {
        if (rawMime == null || rawMime.isBlank()) {
            return null;
        }
        int semicolon = rawMime.indexOf(';');
        String base = (semicolon >= 0 ? rawMime.substring(0, semicolon) : rawMime)
                .trim()
                .toLowerCase(Locale.ROOT);
        if ("image/jpg".equals(base)) {
            return "image/jpeg";
        }
        return base.isEmpty() ? null : base;
    }

    private static String resolveMultipartImageMime(String contentType, String originalFilename) {
        String normalized = normalizeImageMime(contentType);
        if (normalized != null && ALLOWED_IMAGE_MIMES.contains(normalized)) {
            return normalized;
        }
        if (originalFilename != null) {
            String lower = originalFilename.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".gif")) return "image/gif";
            if (lower.endsWith(".heic")) return "image/heic";
            if (lower.endsWith(".heif")) return "image/heif";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        }
        if (normalized != null) {
            return normalized;
        }
        return "image/jpeg";
    }

    private static StoredThumbnail createThumbnailForStorage(byte[] originalBytes, String cleanBase64, String mimeType) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(originalBytes));
            if (source != null && source.getWidth() > 0 && source.getHeight() > 0) {
                int w = source.getWidth();
                int h = source.getHeight();
                double scale = Math.min(1.0, (double) THUMBNAIL_MAX_DIMENSION / Math.max(w, h));
                int targetW = Math.max(1, (int) Math.round(w * scale));
                int targetH = Math.max(1, (int) Math.round(h * scale));

                BufferedImage rgbImage = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
                Graphics2D g2d = rgbImage.createGraphics();
                try {
                    g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                    g2d.fillRect(0, 0, targetW, targetH);
                    g2d.drawImage(source, 0, 0, targetW, targetH, null);
                } finally {
                    g2d.dispose();
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                if (ImageIO.write(rgbImage, "jpg", baos)) {
                    byte[] thumbBytes = baos.toByteArray();
                    if (thumbBytes.length > 0 && thumbBytes.length <= originalBytes.length) {
                        return new StoredThumbnail(Base64.getEncoder().encodeToString(thumbBytes), "image/jpeg");
                    }
                }
            }
        } catch (Exception ignored) {
            // Fall back to bounded original payload if ImageIO cannot decode format (e.g. WebP/synthetic)
        }

        if (cleanBase64.length() <= MAX_STORED_RAW_BASE64_LENGTH) {
            return new StoredThumbnail(cleanBase64, mimeType);
        }
        return new StoredThumbnail(null, mimeType);
    }

    private record ValidatedImage(String cleanBase64, String mimeType, byte[] bytes) {}

    private record StoredThumbnail(String base64, String mimeType) {}
}
