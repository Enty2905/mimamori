package com.mimamori.conversation.repository;

import com.mimamori.conversation.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT c FROM Conversation c WHERE c.id=:id")
    java.util.Optional<Conversation> findLockedById(@org.springframework.data.repository.query.Param("id") Long id);
    List<Conversation> findByElderlyIdOrderByLastMessageAtDesc(Long elderlyId);
    Optional<Conversation> findFirstByElderlyIdOrderByLastMessageAtDesc(Long elderlyId);
}

