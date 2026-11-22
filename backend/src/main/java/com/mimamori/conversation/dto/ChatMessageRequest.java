package com.mimamori.conversation.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ChatMessageRequest {

    @JsonAlias({"message", "text", "question", "prompt"})
    private String content;

    private String message;

    private String question;

    @JsonAlias({"image", "imageData"})
    private String imageBase64;

    @JsonAlias({"imageMimeType", "contentType"})
    private String mimeType;

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
        if (question != null && !question.isBlank()) {
            return question.trim();
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

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getImageBase64() {
        return imageBase64;
    }

    public void setImageBase64(String imageBase64) {
        this.imageBase64 = imageBase64;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public boolean hasImage() {
        return imageBase64 != null && !imageBase64.isBlank();
    }
}
