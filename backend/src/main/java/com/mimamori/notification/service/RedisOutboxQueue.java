package com.mimamori.notification.service;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Redis carries wake-up IDs only; the JDBC outbox remains authoritative during outages. */
@Component
public class RedisOutboxQueue {
    private final StringRedisTemplate redis;
    private final boolean enabled;
    public RedisOutboxQueue(StringRedisTemplate redis,@Value("${mimamori.queue.redis-enabled:true}") boolean enabled){this.redis=redis;this.enabled=enabled;}
    @TransactionalEventListener
    public void enqueue(NotificationQueued event){
        if(!enabled)return;
        try{redis.opsForList().rightPush("mimamori:alert-outbox",event.id().toString());redis.opsForList().trim("mimamori:alert-outbox",-10000,-1);}catch(RuntimeException unavailable){/* Durable database outbox will be polled. */}
    }
    public void drainHints(){if(enabled)try{redis.opsForList().leftPop("mimamori:alert-outbox",50);}catch(RuntimeException unavailable){/* Bounded timeout; dispatch continues from the database. */}}
    public void cacheStatus(Long id,String status){if(enabled)try{redis.opsForValue().set("mimamori:push-status:"+id,status,Duration.ofMinutes(10));}catch(RuntimeException unavailable){/* Cache never owns delivery state. */}}
}
