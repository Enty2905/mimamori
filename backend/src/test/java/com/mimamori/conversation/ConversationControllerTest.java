package com.mimamori.conversation;

import com.mimamori.common.GlobalExceptionHandler;
import com.mimamori.conversation.controller.ConversationController;
import com.mimamori.conversation.dto.ChatMessageDto;
import com.mimamori.conversation.entity.MessageSender;
import com.mimamori.conversation.service.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ConversationControllerTest {

    @Mock
    private ConversationService conversationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new ConversationController(conversationService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void sendMessage_allowsImageWithoutTextContent() throws Exception {
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(50L);
        dto.setConversationId(10L);
        dto.setSender(MessageSender.AI);
        dto.setMessageType("TEXT");
        dto.setContent("Đây là thuốc Paracetamol 500mg ạ.");
        dto.setCreatedAt(Instant.now());

        when(conversationService.sendMessage(isNull(), eq(10L), any())).thenReturn(dto);

        mockMvc.perform(post("/api/conversations/10/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"AQID\",\"mimeType\":\"image/png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value("Đây là thuốc Paracetamol 500mg ạ."));
    }

    @Test
    void sendMessage_rejectsBlankTextWithoutImage() throws Exception {
        mockMvc.perform(post("/api/conversations/10/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void sendMedicineImage_supportsJsonAndMultipart() throws Exception {
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(51L);
        dto.setConversationId(10L);
        dto.setSender(MessageSender.AI);
        dto.setMessageType("TEXT");
        dto.setContent("Đây là Amoxicillin 500mg ạ.");
        dto.setCreatedAt(Instant.now());

        when(conversationService.sendMedicineImageMessage(isNull(), eq(10L), eq("AQID"), eq("image/jpeg"), eq("Thuốc gì?")))
                .thenReturn(dto);

        mockMvc.perform(post("/api/conversations/10/medicine-image")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"AQID\",\"mimeType\":\"image/jpeg\",\"question\":\"Thuốc gì?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("Đây là Amoxicillin 500mg ạ."));

        when(conversationService.sendMedicineImageMessage(isNull(), eq(10L), any(org.springframework.web.multipart.MultipartFile.class), eq("Uống mấy viên?")))
                .thenReturn(dto);

        MockMultipartFile img = new MockMultipartFile("image", "med.jpg", "image/jpeg", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/conversations/10/medicine-image")
                        .file(img)
                        .param("question", "Uống mấy viên?"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
