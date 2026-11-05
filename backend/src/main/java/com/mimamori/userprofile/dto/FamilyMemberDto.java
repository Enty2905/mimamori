package com.mimamori.userprofile.dto;

import com.mimamori.userprofile.entity.FamilyRelationship;
import com.mimamori.userprofile.entity.RelationshipStatus;

import java.time.Instant;

public class FamilyMemberDto {
    private Long relationshipId;
    private UserDto member;
    private String relationshipType;
    private RelationshipStatus status;
    private Boolean canViewConversations;
    private Instant linkedAt;

    public static FamilyMemberDto fromCaregiverView(FamilyRelationship rel) {
        FamilyMemberDto dto = new FamilyMemberDto();
        dto.setRelationshipId(rel.getId());
        dto.setMember(UserDto.fromEntity(rel.getElderly()));
        dto.setRelationshipType(rel.getRelationshipType());
        dto.setStatus(rel.getStatus());
        dto.setCanViewConversations(rel.getCanViewConversations());
        dto.setLinkedAt(rel.getCreatedAt());
        return dto;
    }

    public static FamilyMemberDto fromElderlyView(FamilyRelationship rel) {
        FamilyMemberDto dto = new FamilyMemberDto();
        dto.setRelationshipId(rel.getId());
        dto.setMember(UserDto.fromEntity(rel.getCaregiver()));
        dto.setRelationshipType(rel.getRelationshipType());
        dto.setStatus(rel.getStatus());
        dto.setCanViewConversations(rel.getCanViewConversations());
        dto.setLinkedAt(rel.getCreatedAt());
        return dto;
    }

    public Long getRelationshipId() { return relationshipId; }
    public void setRelationshipId(Long relationshipId) { this.relationshipId = relationshipId; }
    public UserDto getMember() { return member; }
    public void setMember(UserDto member) { this.member = member; }
    public String getRelationshipType() { return relationshipType; }
    public void setRelationshipType(String relationshipType) { this.relationshipType = relationshipType; }
    public RelationshipStatus getStatus() { return status; }
    public void setStatus(RelationshipStatus status) { this.status = status; }
    public Boolean getCanViewConversations() { return canViewConversations; }
    public void setCanViewConversations(Boolean canViewConversations) { this.canViewConversations = canViewConversations; }
    public Instant getLinkedAt() { return linkedAt; }
    public void setLinkedAt(Instant linkedAt) { this.linkedAt = linkedAt; }
}

