package com.mimamori.conversation;

import com.mimamori.common.ApiException;
import com.mimamori.common.DeepSeekService;
import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.ChatMessageDto;
import com.mimamori.conversation.dto.ChatMessageRequest;
import com.mimamori.conversation.entity.ChatMessage;
import com.mimamori.conversation.entity.Conversation;
import com.mimamori.conversation.entity.MessageSender;
import com.mimamori.conversation.repository.ChatMessageRepository;
import com.mimamori.conversation.repository.ConversationRepository;
import com.mimamori.conversation.service.ConversationService;
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
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock
    private ConversationRepository conversationRepository;
    @Mock
    private ChatMessageRepository messageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FamilyRelationshipRepository relationshipRepository;
    @Mock
    private GroqService groqService;
    @Mock
    private DeepSeekService deepSeekService;

    private ConversationService service;
    private User elderly;
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        service = new ConversationService(
                conversationRepository,
                messageRepository,
                userRepository,
                relationshipRepository,
                "http://localhost:8000",
                groqService,
                deepSeekService
        );

        elderly = new User();
        elderly.setId(1L);
        elderly.setUsername("ong_ba");
        elderly.setFullName("Nguyễn Văn Ba");
        elderly.setRole(UserRole.ELDERLY);

        conversation = new Conversation(elderly, "Trò chuyện cùng Mimamori AI");
        conversation.setId(10L);
    }

    private static String createSamplePngBase64(int width, int height) throws Exception {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        return Base64.getEncoder().encodeToString(baos.toByteArray());
    }

    @Test
    void sendMessage_withImageBase64DataUri_analyzesViaDeepSeekVisionAndPersistsThumbnail() throws Exception {
        String pngBase64 = createSamplePngBase64(800, 600);
        String dataUri = "data:image/png;base64," + pngBase64;

        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(10L)).thenReturn(List.of());
        when(deepSeekService.isEnabled()).thenReturn(true);
        when(deepSeekService.analyzeMedicineImage(
                eq("Thuốc này uống lúc nào cháu?"),
                eq("Nguyễn Văn Ba"),
                eq(pngBase64),
                eq("image/png"),
                anyList()
        )).thenReturn("Dạ đây là thuốc PARACETAMOL 500mg ạ.");

        AtomicLong idGen = new AtomicLong(100L);
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            if (m.getId() == null) m.setId(idGen.getAndIncrement());
            return m;
        });

        ChatMessageRequest req = new ChatMessageRequest();
        req.setContent("Thuốc này uống lúc nào cháu?");
        req.setImageBase64(dataUri);

        ChatMessageDto result = service.sendMessage(1L, 10L, req);

        assertEquals(MessageSender.AI, result.getSender());
        assertEquals("TEXT", result.getMessageType());
        assertEquals("Dạ đây là thuốc PARACETAMOL 500mg ạ.", result.getContent());

        ArgumentCaptor<ChatMessage> savedCaptor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(messageRepository, times(2)).save(savedCaptor.capture());
        ChatMessage userSaved = savedCaptor.getAllValues().get(0);
        assertEquals(MessageSender.USER, userSaved.getSender());
        assertEquals("MEDICINE_IMAGE", userSaved.getMessageType());
        assertEquals("Thuốc này uống lúc nào cháu?", userSaved.getContent());
        assertNotNull(userSaved.getImageBase64());
        assertNotNull(userSaved.getImageMimeType());
        verify(groqService, never()).generateCompanionReply(any(), any(), any());
    }

    @Test
    void sendMedicineImageMessage_usesDefaultQuestionWhenBlank_andSupportsMultipart() throws Exception {
        byte[] pngBytes = Base64.getDecoder().decode(createSamplePngBase64(120, 80));
        MockMultipartFile file = new MockMultipartFile("image", "box.png", "image/png", pngBytes);

        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(10L)).thenReturn(List.of());
        when(deepSeekService.isEnabled()).thenReturn(true);
        when(deepSeekService.analyzeMedicineImage(
                contains("Đây là thuốc gì"),
                eq("Nguyễn Văn Ba"),
                anyString(),
                eq("image/png"),
                anyList()
        )).thenReturn("Dạ đây là thuốc Amoxicillin 500mg ạ.");
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId(200L);
            return m;
        });

        ChatMessageDto result = service.sendMedicineImageMessage(1L, 10L, file, "   ");

        assertEquals("Dạ đây là thuốc Amoxicillin 500mg ạ.", result.getContent());
    }

    @Test
    void sendMedicineImageMessage_neverFallsBackToTextOnlyWhenVisionUnavailable() throws Exception {
        String pngBase64 = createSamplePngBase64(50, 50);

        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(10L)).thenReturn(List.of());
        when(deepSeekService.isEnabled()).thenReturn(false);
        when(groqService.isVisionConfigured()).thenReturn(false);

        ApiException ex = assertThrows(
                ApiException.class,
                () -> service.sendMedicineImageMessage(1L, 10L, pngBase64, "image/png", "Thuốc gì đây?")
        );

        assertEquals(503, ex.getStatus());
        verify(groqService, never()).generateCompanionReply(any(), any(), any());
        verify(messageRepository, never()).save(any());
    }

    @Test
    void sendMedicineImageMessage_fallsBackToGroqVisionWhenConfigured() throws Exception {
        String pngBase64 = createSamplePngBase64(50, 50);

        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(10L)).thenReturn(List.of());
        when(deepSeekService.isEnabled()).thenReturn(true);
        when(deepSeekService.analyzeMedicineImage(any(), any(), any(), any(), any())).thenReturn(null);
        when(groqService.isVisionConfigured()).thenReturn(true);
        when(groqService.analyzeMedicineImage(any(), eq("Nguyễn Văn Ba"), eq(pngBase64), eq("image/png")))
                .thenReturn("Đây là Panadol 500mg từ Groq Vision ạ.");
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> inv.getArgument(0));

        ChatMessageDto result = service.sendMedicineImageMessage(1L, 10L, pngBase64, "image/png", null);

        assertEquals("Đây là Panadol 500mg từ Groq Vision ạ.", result.getContent());
    }

    @Test
    void sendMedicineImageMessage_rejectsInvalidMimeInvalidBase64OversizedAndNonOwner() {
        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conversation));

        ApiException forbidden = assertThrows(
                ApiException.class,
                () -> service.sendMedicineImageMessage(99L, 10L, "AQID", "image/png", "?")
        );
        assertEquals(403, forbidden.getStatus());

        ApiException badMime = assertThrows(
                ApiException.class,
                () -> service.sendMedicineImageMessage(1L, 10L, "AQID", "application/pdf", "?")
        );
        assertEquals(400, badMime.getStatus());

        ApiException badBase64 = assertThrows(
                ApiException.class,
                () -> service.sendMedicineImageMessage(1L, 10L, "not-valid-base64!!!", "image/jpeg", "?")
        );
        assertEquals(400, badBase64.getStatus());

        String oversized = Base64.getEncoder().encodeToString(new byte[10 * 1024 * 1024 + 1]);
        ApiException tooLarge = assertThrows(
                ApiException.class,
                () -> service.sendMedicineImageMessage(1L, 10L, oversized, "image/jpeg", "?")
        );
        assertEquals(413, tooLarge.getStatus());
    }
}
