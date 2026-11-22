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

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ConversationService {

    private static final Logger log = LoggerFactory.getLogger(ConversationService.class);

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
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ApiException(404, "Conversation not found"));

        if (!conv.getElderly().getId().equals(elderlyId)) {
            throw new ApiException(403, "You do not own this conversation");
        }

        // 1. Save user message
        ChatMessage userMsg = new ChatMessage(conv, MessageSender.USER, request.getContent());
        userMsg = messageRepository.save(userMsg);

        // 2. Query AI response from Groq LLM or internal AI service
        String aiReplyContent = fetchAiCompanionReply(conv, request.getContent());

        // 3. Save AI message
        ChatMessage aiMsg = new ChatMessage(conv, MessageSender.AI, aiReplyContent);
        aiMsg = messageRepository.save(aiMsg);

        conv.setLastMessageAt(Instant.now());
        conversationRepository.save(conv);

        return ChatMessageDto.fromEntity(aiMsg);
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
}
