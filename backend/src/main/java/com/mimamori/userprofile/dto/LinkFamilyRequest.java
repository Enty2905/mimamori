package com.mimamori.userprofile.dto;

import jakarta.validation.constraints.NotBlank;

public class LinkFamilyRequest {

    @NotBlank(message = "Elderly username is required")
    private String elderlyUsername;

    private String relationshipType = "FAMILY";

    public String getElderlyUsername() { return elderlyUsername; }
    public void setElderlyUsername(String elderlyUsername) { this.elderlyUsername = elderlyUsername; }
    public String getRelationshipType() { return relationshipType; }
    public void setRelationshipType(String relationshipType) { this.relationshipType = relationshipType; }
}

