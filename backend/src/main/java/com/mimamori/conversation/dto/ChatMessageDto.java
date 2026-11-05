package com.mimamori.conversation.dto;

import com.mimamori.conversation.entity.ChatMessage;
import com.mimamori.conversation.entity.MessageSender;

import java.time.Instant;

public class ChatMessageDto {
    private Long id;
    private Long conversationId;
    private MessageSender sender;
    private String content;
    private Instant createdAt;

    public static ChatMessageDto fromEntity(ChatMessage msg) {
        if (msg == null) return null;
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(msg.getId());
        dto.setConversationId(msg.getConversation().getId());
        dto.setSender(msg.getSender());
        dto.setContent(msg.getContent());
        dto.setCreatedAt(msg.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public MessageSender getSender() { return sender; }
    public void setSender(MessageSender sender) { this.sender = sender; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

