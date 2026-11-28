package com.mimamori.conversation.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ChatMessageRequest {

    @JsonAlias({"message", "text"})
    private String content;

    private String message;
    private java.util.UUID requestId;

    public ChatMessageRequest() {}

    public ChatMessageRequest(String content) {
        this.content = content;
    }

    public String getContent() {
        if (content != null && !content.isBlank()) {
            return content.trim();
        }
        if (message != null && !message.isBlank()) {
            return message.trim();
        }
        return "";
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMessage() {
        return message;
    }
    public java.util.UUID getRequestId() { return requestId; }
    public void setRequestId(java.util.UUID value) { requestId = value; }

    public void setMessage(String message) {
        this.message = message;
    }
}
