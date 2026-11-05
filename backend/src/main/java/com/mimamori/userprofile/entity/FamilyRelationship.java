package com.mimamori.userprofile.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "family_relationships", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"caregiver_id", "elderly_id"})
})
public class FamilyRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caregiver_id", nullable = false)
    private User caregiver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @Column(name = "relationship_type", length = 50)
    private String relationshipType = "FAMILY";

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RelationshipStatus status = RelationshipStatus.ACCEPTED;

    @Column(name = "can_view_conversations")
    private Boolean canViewConversations = true;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public FamilyRelationship() {}

    public FamilyRelationship(User caregiver, User elderly, String relationshipType, RelationshipStatus status) {
        this.caregiver = caregiver;
        this.elderly = elderly;
        this.relationshipType = relationshipType;
        this.status = status;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getCaregiver() { return caregiver; }
    public void setCaregiver(User caregiver) { this.caregiver = caregiver; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
    public String getRelationshipType() { return relationshipType; }
    public void setRelationshipType(String relationshipType) { this.relationshipType = relationshipType; }
    public RelationshipStatus getStatus() { return status; }
    public void setStatus(RelationshipStatus status) { this.status = status; }
    public Boolean getCanViewConversations() { return canViewConversations; }
    public void setCanViewConversations(Boolean canViewConversations) { this.canViewConversations = canViewConversations; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

