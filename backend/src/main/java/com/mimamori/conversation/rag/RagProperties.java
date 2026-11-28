package com.mimamori.conversation.rag;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("mimamori.rag")
public record RagProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("http://127.0.0.1:8000") URI baseUrl,
        @DefaultValue("") String internalToken,
        @DefaultValue("PT5S") Duration timeout,
        @DefaultValue("PT1S") Duration connectTimeout,
        @DefaultValue("65536") int maxResponseBytes,
        @DefaultValue("4") int maxConcurrent) {
    public RagProperties {
        if (baseUrl == null || !java.util.Set.of("http", "https").contains(baseUrl.getScheme())
                || baseUrl.getHost() == null || baseUrl.getUserInfo() != null
                || baseUrl.getQuery() != null || baseUrl.getFragment() != null
                || timeout == null || timeout.toMillis() < 100 || timeout.toMillis() > 30000
                || connectTimeout == null || connectTimeout.isNegative() || connectTimeout.isZero()
                || connectTimeout.compareTo(timeout) > 0
                || maxResponseBytes < 1024 || maxResponseBytes > 262144
                || maxConcurrent < 1 || maxConcurrent > 16)
            throw new IllegalArgumentException("Invalid internal RAG configuration");
    }
    @Override public String toString() { return "RagProperties[redacted]"; }
}
