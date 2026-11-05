package com.mimamori.conversation.repository;

import com.mimamori.conversation.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByElderlyIdOrderByLastMessageAtDesc(Long elderlyId);
    Optional<Conversation> findFirstByElderlyIdOrderByLastMessageAtDesc(Long elderlyId);
}

