package com.mimamori.conversation.dto;

import com.mimamori.conversation.entity.ChatMessage;
import com.mimamori.conversation.entity.MessageSender;

import java.time.Instant;

public class ChatMessageDto {
    private Long id;
    private Long conversationId;
    private MessageSender sender;
    private String messageType;
    private String content;
    private String imageBase64;
    private String imageMimeType;
    private Instant createdAt;

    public static ChatMessageDto fromEntity(ChatMessage msg) {
        if (msg == null) return null;
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(msg.getId());
        dto.setConversationId(msg.getConversation().getId());
        dto.setSender(msg.getSender());
        dto.setMessageType(msg.getMessageType() != null ? msg.getMessageType() : "TEXT");
        dto.setContent(msg.getContent());
        dto.setImageBase64(msg.getImageBase64());
        dto.setImageMimeType(msg.getImageMimeType());
        dto.setCreatedAt(msg.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public MessageSender getSender() { return sender; }
    public void setSender(MessageSender sender) { this.sender = sender; }
    public String getMessageType() { return messageType; }
    public void setMessageType(String messageType) { this.messageType = messageType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }
    public String getImageMimeType() { return imageMimeType; }
    public void setImageMimeType(String imageMimeType) { this.imageMimeType = imageMimeType; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

