package com.mimamori.conversation.service;

import com.mimamori.common.ApiException;
import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.*;
import com.mimamori.conversation.entity.*;
import com.mimamori.conversation.repository.*;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.*;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationService {
    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final UserRepository users;
    private final FamilyRelationshipRepository links;
    private final JdbcTemplate jdbc;
    public ConversationService(ConversationRepository conversations, ChatMessageRepository messages, UserRepository users, FamilyRelationshipRepository links, JdbcTemplate jdbc) {
        this.conversations=conversations;this.messages=messages;this.users=users;this.links=links;this.jdbc=jdbc;
    }
    @Transactional
    public ConversationDto getOrCreateActiveConversation(Long userId) {
        var user=users.findLockedById(userId).orElseThrow(()->new ApiException(401,"Invalid session"));
        if(user.getRole()!=UserRole.ELDERLY)throw new ApiException(403,"Only elderly users can use the companion");
        var conversation=conversations.findFirstByElderlyIdOrderByLastMessageAtDesc(userId)
                .orElseGet(()->conversations.save(new Conversation(user,"Mimamori")));
        return ConversationDto.fromEntity(conversation,false);
    }
    public record Turn(UUID requestId,UUID lease,Long conversationId,Long userId,String text,List<Map<String,String>> history,ChatMessageDto replay) {
        @Override public String toString(){return "ConversationTurn[redacted]";}
    }
    @Transactional
    public Turn prepare(Long userId,Long conversationId,ChatMessageRequest request) {
        var conversation=conversations.findLockedById(conversationId).orElseThrow(()->new ApiException(404,"Conversation not found"));
        if(!conversation.getElderly().getId().equals(userId))throw new ApiException(403,"Not authorized");
        if(request.getContent().isBlank()||request.getContent().length()>4000)throw new ApiException(400,"Invalid message");
        UUID id=request.getRequestId()==null?UUID.randomUUID():request.getRequestId();
        UUID lease=UUID.randomUUID();
        var existing=jdbc.queryForList("SELECT * FROM conversation_turns WHERE request_id=? FOR UPDATE",id.toString());
        if(!existing.isEmpty()){
            var row=existing.getFirst();
            if(((Number)row.get("user_id")).longValue()!=userId||((Number)row.get("conversation_id")).longValue()!=conversationId)throw new ApiException(403,"Not authorized");
            if("COMPLETE".equals(row.get("status")))return new Turn(id,lease,conversationId,userId,"",List.of(),ChatMessageDto.fromEntity(messages.findById(((Number)row.get("reply_message_id")).longValue()).orElseThrow()));
            if("PROCESSING".equals(row.get("status"))&&((Timestamp)row.get("lease_until")).toInstant().isAfter(Instant.now()))throw new ApiException(409,"A reply is already being generated");
            jdbc.update("UPDATE conversation_turns SET status='PROCESSING',lease_id=?,lease_until=? WHERE request_id=?",lease.toString(),Timestamp.from(Instant.now().plusSeconds(20)),id.toString());
        }else{
            messages.saveAndFlush(new ChatMessage(conversation,MessageSender.USER,request.getContent()));
            jdbc.update("INSERT INTO conversation_turns(request_id,conversation_id,user_id,status,lease_id,lease_until) VALUES (?,?,?,'PROCESSING',?,?)",id.toString(),conversationId,userId,lease.toString(),Timestamp.from(Instant.now().plusSeconds(20)));
        }
        var history=new ArrayList<Map<String,String>>();
        var recent=new ArrayList<>(messages.findTop6ByConversationIdOrderByCreatedAtDesc(conversationId));
        Collections.reverse(recent);
        for(var message:recent)history.add(Map.of("role",message.getSender()==MessageSender.USER?"user":"assistant","content",message.getContent()));
        if(!history.isEmpty()&&history.getLast().get("content").equals(request.getContent()))history.removeLast();
        return new Turn(id,lease,conversationId,userId,request.getContent(),List.copyOf(history),null);
    }
    @Transactional
    public ChatMessageDto finish(Turn turn,String reply) {
        var conversation=conversations.findLockedById(turn.conversationId()).orElseThrow();
        var rows=jdbc.queryForList("SELECT status,lease_id FROM conversation_turns WHERE request_id=? FOR UPDATE",turn.requestId().toString());
        if(rows.isEmpty()||!"PROCESSING".equals(rows.getFirst().get("status"))||!turn.lease().toString().equals(rows.getFirst().get("lease_id")))throw new ApiException(409,"Reply was canceled");
        if(reply.isBlank()||reply.length()>16000)throw new ApiException(503,"Reply unavailable");
        var message=messages.saveAndFlush(new ChatMessage(conversation,MessageSender.AI,reply));
        conversation.setLastMessageAt(Instant.now());
        jdbc.update("UPDATE conversation_turns SET status='COMPLETE',reply_message_id=? WHERE request_id=?",message.getId(),turn.requestId().toString());
        return ChatMessageDto.fromEntity(message);
    }
    @Transactional
    public void cancel(Turn turn) {
        jdbc.update("UPDATE conversation_turns SET status='CANCELED' WHERE request_id=? AND lease_id=? AND status='PROCESSING'",turn.requestId().toString(),turn.lease().toString());
    }
    @Transactional(readOnly=true)
    public List<ChatMessageDto> getMessages(Long userId,Long conversationId) {
        var conversation=conversations.findById(conversationId).orElseThrow(()->new ApiException(404,"Conversation not found"));
        Long owner=conversation.getElderly().getId();
        if(!owner.equals(userId)){
            boolean accepted=links.existsByCaregiverIdAndElderlyId(userId,owner);
            boolean permission=links.findByCaregiverIdAndElderlyId(userId,owner).map(link->Boolean.TRUE.equals(link.getCanViewConversations())).orElse(false);
            if(!accepted||!permission)throw new ApiException(403,"Not authorized");
        }
        var recent=new ArrayList<>(messages.findTop200ByConversationIdOrderByCreatedAtDesc(conversationId));Collections.reverse(recent);
        return recent.stream().map(ChatMessageDto::fromEntity).toList();
    }
}
