package com.mimamori.conversation.controller;

import com.mimamori.common.ApiException;
import com.mimamori.common.ApiResponse;
import com.mimamori.conversation.dto.ChatMessageDto;
import com.mimamori.conversation.dto.ChatMessageRequest;
import com.mimamori.conversation.dto.ConversationDto;
import com.mimamori.conversation.service.ConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@Tag(name = "AI Companion Conversations", description = "Endpoints for friendly AI companion chatting and message history")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @GetMapping("/active")
    @Operation(summary = "Get or create active conversation for elderly user")
    public ApiResponse<ConversationDto> getActiveConversation(@AuthenticationPrincipal Long elderlyId) {
        return ApiResponse.ok(conversationService.getOrCreateActiveConversation(elderlyId));
    }

    @PostMapping("/{id}/messages")
    @Operation(summary = "Send a message (text or medicine image) to AI companion and receive empathetic response")
    public ApiResponse<ChatMessageDto> sendMessage(
            @AuthenticationPrincipal Long elderlyId,
            @PathVariable("id") Long conversationId,
            @RequestBody ChatMessageRequest request) {
        if (request == null || (request.getContent().isBlank() && !request.hasImage())) {
            throw new ApiException(400, "Nội dung tin nhắn không được để trống");
        }
        return ApiResponse.ok(conversationService.sendMessage(elderlyId, conversationId, request));
    }

    @PostMapping(value = "/{id}/medicine-image", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Send a base64 medicine photo with optional Vietnamese question to AI companion")
    public ApiResponse<ChatMessageDto> sendMedicineImageJson(
            @AuthenticationPrincipal Long elderlyId,
            @PathVariable("id") Long conversationId,
            @RequestBody ChatMessageRequest request) {
        if (request == null || !request.hasImage()) {
            throw new ApiException(400, "Vui lòng chọn hoặc chụp ảnh thuốc để cháu xem giúp bác nhé.");
        }
        return ApiResponse.ok(conversationService.sendMedicineImageMessage(
                elderlyId,
                conversationId,
                request.getImageBase64(),
                request.getMimeType(),
                request.getContent()
        ));
    }

    @PostMapping(value = "/{id}/medicine-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a medicine photo via multipart form-data with optional question to AI companion")
    public ApiResponse<ChatMessageDto> sendMedicineImageMultipart(
            @AuthenticationPrincipal Long elderlyId,
            @PathVariable("id") Long conversationId,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "question", required = false) String question,
            @RequestParam(value = "content", required = false) String content) {
        String resolvedQuestion = (question != null && !question.isBlank()) ? question : content;
        return ApiResponse.ok(conversationService.sendMedicineImageMessage(
                elderlyId,
                conversationId,
                image,
                resolvedQuestion
        ));
    }

    @GetMapping("/{id}/messages")
    @Operation(summary = "Get message history of a conversation")
    public ApiResponse<List<ChatMessageDto>> getMessages(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long conversationId) {
        return ApiResponse.ok(conversationService.getMessages(userId, conversationId));
    }
}
