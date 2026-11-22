package com.mimamori.conversation.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageSender sender;

    @Column(name = "message_type", nullable = false, length = 30)
    private String messageType = "TEXT";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_base64", columnDefinition = "MEDIUMTEXT")
    private String imageBase64;

    @Column(name = "image_mime_type", length = 64)
    private String imageMimeType;

    @Column(name = "tokens_used")
    private Integer tokensUsed = 0;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public ChatMessage() {}

    public ChatMessage(Conversation conversation, MessageSender sender, String content) {
        this.conversation = conversation;
        this.sender = sender;
        this.content = content;
        this.messageType = "TEXT";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Conversation getConversation() { return conversation; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }
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
    public Integer getTokensUsed() { return tokensUsed; }
    public void setTokensUsed(Integer tokensUsed) { this.tokensUsed = tokensUsed; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

