package com.mimamori.conversation.controller;

import com.mimamori.common.ApiException;
import com.mimamori.common.ApiResponse;
import com.mimamori.conversation.dto.ChatMessageDto;
import com.mimamori.conversation.dto.ChatMessageRequest;
import com.mimamori.conversation.dto.ConversationDto;
import com.mimamori.conversation.service.ConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@Tag(name = "AI Companion Conversations", description = "Endpoints for friendly AI companion chatting and message history")
public class ConversationController {

    private final ConversationService conversationService;
    private final com.mimamori.common.GroqService companion;

    public ConversationController(ConversationService conversationService, com.mimamori.common.GroqService companion) {
        this.conversationService = conversationService;
        this.companion = companion;
    }

    @GetMapping("/active")
    @Operation(summary = "Get or create active conversation for elderly user")
    public ApiResponse<ConversationDto> getActiveConversation(@AuthenticationPrincipal Long elderlyId) {
        return ApiResponse.ok(conversationService.getOrCreateActiveConversation(elderlyId));
    }

    @PostMapping("/{id}/messages")
    @Operation(summary = "Send a message to AI companion and receive empathetic response")
    public ApiResponse<ChatMessageDto> sendMessage(
            @AuthenticationPrincipal Long elderlyId,
            @PathVariable("id") Long conversationId,
            @RequestBody ChatMessageRequest request) {
        if (request == null || request.getContent().isBlank()) {
            throw new ApiException(400, "Nội dung tin nhắn không được để trống");
        }
        var turn = conversationService.prepare(elderlyId,conversationId,request);
        if (turn.replay() != null) return ApiResponse.ok(turn.replay());
        try { return ApiResponse.ok(conversationService.finish(turn,companion.generateCompanionReply(turn.text(),"",turn.history()))); }
        catch (RuntimeException failure) { conversationService.cancel(turn); throw failure; }
    }

    @GetMapping("/{id}/messages")
    @Operation(summary = "Get message history of a conversation")
    public ApiResponse<List<ChatMessageDto>> getMessages(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long conversationId) {
        return ApiResponse.ok(conversationService.getMessages(userId, conversationId));
    }
}
