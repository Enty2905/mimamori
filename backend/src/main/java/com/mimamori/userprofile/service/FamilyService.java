package com.mimamori.userprofile.service;

import com.mimamori.common.ApiException;
import com.mimamori.userprofile.dto.FamilyMemberDto;
import com.mimamori.userprofile.dto.LinkFamilyRequest;
import com.mimamori.userprofile.entity.FamilyRelationship;
import com.mimamori.userprofile.entity.RelationshipStatus;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class FamilyService {

    private final FamilyRelationshipRepository relationshipRepository;
    private final UserRepository userRepository;

    public FamilyService(FamilyRelationshipRepository relationshipRepository, UserRepository userRepository) {
        this.relationshipRepository = relationshipRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public FamilyMemberDto linkElderly(Long caregiverId, LinkFamilyRequest request) {
        User caregiver = userRepository.findById(caregiverId)
                .orElseThrow(() -> new ApiException(404, "Caregiver not found"));

        if (caregiver.getRole() != UserRole.CAREGIVER) {
            throw new ApiException(403, "Only caregivers can initiate linking an elderly user");
        }

        User elderly = userRepository.findByUsername(request.getElderlyUsername())
                .orElseThrow(() -> new ApiException(404, "Elderly user not found with username: " + request.getElderlyUsername()));

        if (elderly.getRole() != UserRole.ELDERLY) {
            throw new ApiException(400, "The requested user is not registered as an ELDERLY role");
        }

        if (relationshipRepository.findByCaregiverIdAndElderlyId(caregiverId, elderly.getId()).isPresent()) {
            throw new ApiException(400, "Family relationship already exists between these users");
        }

        FamilyRelationship relationship = new FamilyRelationship(
                caregiver,
                elderly,
                request.getRelationshipType() != null ? request.getRelationshipType() : "FAMILY",
                RelationshipStatus.PENDING
        );

        relationship = relationshipRepository.save(relationship);
        return FamilyMemberDto.fromCaregiverView(relationship);
    }

    @Transactional
    public FamilyMemberDto accept(Long userId, Long id) {
        var link = relationshipRepository.findById(id).orElseThrow(() -> new ApiException(404, "Link not found"));
        if (!link.getElderly().getId().equals(userId)) throw new ApiException(403, "Only the elderly owner can accept this link");
        link.setStatus(RelationshipStatus.ACCEPTED);
        return FamilyMemberDto.fromElderlyView(link);
    }

    public List<FamilyMemberDto> getFamilyMembers(Long currentUserId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        if (currentUser.getRole() == UserRole.CAREGIVER) {
            return relationshipRepository.findByCaregiverId(currentUserId)
                    .stream()
                    .map(FamilyMemberDto::fromCaregiverView)
                    .collect(Collectors.toList());
        } else {
            return relationshipRepository.findByElderlyId(currentUserId)
                    .stream()
                    .map(FamilyMemberDto::fromElderlyView)
                    .collect(Collectors.toList());
        }
    }

    @Transactional
    public void removeFamilyLink(Long currentUserId, Long relationshipId) {
        FamilyRelationship rel = relationshipRepository.findById(relationshipId)
                .orElseThrow(() -> new ApiException(404, "Relationship not found"));

        if (!rel.getCaregiver().getId().equals(currentUserId) && !rel.getElderly().getId().equals(currentUserId)) {
            throw new ApiException(403, "You do not have permission to delete this relationship");
        }

        relationshipRepository.delete(rel);
    }
}

