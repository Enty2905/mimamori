package com.mimamori.conversation.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ChatMessageRequest {

    @JsonAlias({"message", "text"})
    private String content;

    private String message;

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

    public void setMessage(String message) {
        this.message = message;
    }
}
