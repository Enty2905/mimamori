package com.mimamori.speech;

public class SpeechTranscriptionResponse {
    private String text;
    private String language;
    private String model;

    public SpeechTranscriptionResponse() {
    }

    public SpeechTranscriptionResponse(String text, String language, String model) {
        this.text = text;
        this.language = language;
        this.model = model;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }
}
