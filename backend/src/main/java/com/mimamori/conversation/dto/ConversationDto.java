package com.mimamori.conversation.dto;

import com.mimamori.conversation.entity.Conversation;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

public class ConversationDto {
    private Long id;
    private Long elderlyId;
    private String title;
    private Instant lastMessageAt;
    private List<ChatMessageDto> messages;
    private Instant createdAt;

    public static ConversationDto fromEntity(Conversation conv, boolean includeMessages) {
        if (conv == null) return null;
        ConversationDto dto = new ConversationDto();
        dto.setId(conv.getId());
        dto.setElderlyId(conv.getElderly().getId());
        dto.setTitle(conv.getTitle());
        dto.setLastMessageAt(conv.getLastMessageAt());
        dto.setCreatedAt(conv.getCreatedAt());
        if (includeMessages && conv.getMessages() != null) {
            dto.setMessages(conv.getMessages().stream()
                    .map(ChatMessageDto::fromEntity)
                    .collect(Collectors.toList()));
        }
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(Instant lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public List<ChatMessageDto> getMessages() { return messages; }
    public void setMessages(List<ChatMessageDto> messages) { this.messages = messages; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

