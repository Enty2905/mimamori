package com.mimamori.conversation.controller;

import com.mimamori.common.GroqService;
import com.mimamori.conversation.dto.ChatMessageRequest;
import com.mimamori.conversation.service.ConversationService;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.scheduler.Schedulers;

@RestController
@RequestMapping("/api/conversations")
public class ConversationStreamController {
    private final ConversationService conversations;
    private final GroqService companion;
    private final java.util.concurrent.Semaphore permits = new java.util.concurrent.Semaphore(4);
    public ConversationStreamController(ConversationService conversations,GroqService companion){this.conversations=conversations;this.companion=companion;}
    @PostMapping(value="/{id}/messages/stream",produces="text/event-stream;charset=UTF-8")
    public SseEmitter stream(@AuthenticationPrincipal Long userId,@PathVariable("id") Long id,@RequestBody ChatMessageRequest request){
        var turn=conversations.prepare(userId,id,request);
        var emitter=new SseEmitter(15000L);
        if(turn.replay()!=null){try{emitter.send(SseEmitter.event().name("done").data(turn.replay()));emitter.complete();}catch(Exception ignored){emitter.complete();}return emitter;}
        if(!permits.tryAcquire()){conversations.cancel(turn);throw new com.mimamori.common.ApiException(429,"Companion is busy");}
        var released = new AtomicBoolean();
        var subscription=new AtomicReference<Disposable>();var ended=new AtomicBoolean();var reply=new StringBuilder();
        Runnable cancel=()->{ended.set(true);var active=subscription.get();if(active!=null)active.dispose();conversations.cancel(turn);};
        Runnable release=()->{cancel.run();if(released.compareAndSet(false,true))permits.release();};
        emitter.onCompletion(release);emitter.onError(error->release.run());
        emitter.onTimeout(()->{try{emitter.send(SseEmitter.event().name("error").data(Map.of("code","STREAM_TIMEOUT")));}catch(Exception ignored){}cancel.run();emitter.complete();});
        subscription.set(companion.streamCompanionReply(turn.text(),turn.history()).subscribeOn(Schedulers.boundedElastic()).subscribe(part->{
            if(ended.get())return;
            try{if(reply.length()+part.length()>16000)throw new IllegalStateException("Reply limit");reply.append(part);emitter.send(SseEmitter.event().name("delta").data(Map.of("text",part)));}
            catch(Exception failure){cancel.run();emitter.complete();}
        },failure->{
            try{emitter.send(SseEmitter.event().name("error").data(Map.of("code","STREAM_UNAVAILABLE")));}catch(Exception ignored){}
            cancel.run();emitter.complete();
        },()->{
            if(ended.get())return;
            try{var message=conversations.finish(turn,reply.toString());emitter.send(SseEmitter.event().name("done").data(message));ended.set(true);emitter.complete();}
            catch(Exception failure){cancel.run();emitter.complete();}
        }));
        if(ended.get()&&subscription.get()!=null)subscription.get().dispose();
        return emitter;
    }
}
