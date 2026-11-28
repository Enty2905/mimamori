package com.mimamori.conversation.rag;

import jakarta.annotation.PreDestroy;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Internal retrieval only: no public controller, generation or reminder dependency. */
@Component
@EnableConfigurationProperties(RagProperties.class)
public final class RagClient {
    private final RagProperties properties;
    private final HttpClient http;
    private final Semaphore permits;
    private final JsonMapper mapper = JsonMapper.builder().build();
    private static final Set<String> EMPTY_REASONS = Set.of("NO_MATCH", "LOW_CONFIDENCE",
            "UNAVAILABLE", "BUSY", "QUERY_TOO_LONG", "INVALID_INDEX", "BUDGET_EXHAUSTED");
    public RagClient(RagProperties properties) {
        this.properties = properties;
        this.permits = new Semaphore(properties.maxConcurrent());
        // Uvicorn serves HTTP/1.1; avoid Java\'s cleartext h2c upgrade handshake.
        this.http = HttpClient.newBuilder().connectTimeout(properties.connectTimeout())
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }
    public RagContext retrieve(RagRequest input) {
        if (!valid(input)) return RagContext.empty("INVALID_REQUEST");
        if (!properties.enabled()) return RagContext.empty("DISABLED");
        if (properties.internalToken() == null || properties.internalToken().length() < 32)
            return RagContext.empty("NOT_CONFIGURED");
        if (!permits.tryAcquire()) return RagContext.empty("BUSY");
        CompletableFuture<HttpResponse<byte[]>> future = null;
        try {
            var request = HttpRequest.newBuilder(properties.baseUrl().resolve("/internal/v1/retrievals"))
                    .timeout(properties.timeout()).header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-Internal-Token", properties.internalToken())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(input))).build();
            future = http.sendAsync(request, ignored -> new LimitedBody(properties.maxResponseBytes()));
            var response = future.get(properties.timeout().toMillis(), TimeUnit.MILLISECONDS);
            if (response.statusCode() != 200) return RagContext.empty("UNAVAILABLE");
            RagContext result;
            try { result = mapper.readValue(response.body(), RagContext.class); }
            catch (Exception error) { return RagContext.empty("INVALID_RESPONSE"); }
            return valid(result, input) ? result : RagContext.empty("INVALID_RESPONSE");
        } catch (TimeoutException error) {
            return RagContext.empty("TIMEOUT");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return RagContext.empty("UNAVAILABLE");
        } catch (Exception error) {
            return RagContext.empty("UNAVAILABLE");
        } finally {
            if (future != null && !future.isDone()) future.cancel(true);
            permits.release();
        }
    }
    private static boolean valid(RagRequest input) {
        if (input == null || input.query() == null || input.query().isBlank()
                || input.query().codePointCount(0, input.query().length()) > 1024
                || !Set.of("ja", "vi").contains(Objects.toString(input.language(), ""))
                || input.topK() < 1 || input.topK() > 8
                || input.maxContextTokens() < 32 || input.maxContextTokens() > 1024
                || input.sourceIds().size() > 20 || input.documentIds().size() > 20) return false;
        return input.sourceIds().stream().allMatch(v -> v.matches("[a-z][a-z0-9_-]{0,79}"))
                && input.documentIds().stream().allMatch(RagClient::uuid);
    }
    private static boolean valid(RagContext result, RagRequest input) {
        try {
            if (result == null || result.schemaVersion() != 1 || result.chunks() == null
                    || result.pipelineId() == null || !result.pipelineId().matches("[a-f0-9]{64}")) return false;
            if ("no_context".equals(result.status())) return EMPTY_REASONS.contains(result.reason())
                    && result.chunks().isEmpty() && result.contextTokens() == 0;
            if (!"context".equals(result.status()) || !"NONE".equals(result.reason())
                    || result.contextTokens() < 1 || result.contextTokens() > input.maxContextTokens()
                    || result.chunks().isEmpty() || result.chunks().size() > input.topK()) return false;
            var ids = new HashSet<String>();
            double previous = Double.POSITIVE_INFINITY;
            for (var chunk : result.chunks()) {
                if (!uuid(chunk.chunkId()) || !uuid(chunk.documentId()) || !ids.add(chunk.chunkId())
                        || !input.language().equals(chunk.language()) || !text(chunk.sourceId(), 80)
                        || !chunk.sourceId().matches("[a-z][a-z0-9_-]{0,79}")
                        || !text(chunk.title(), 240) || !text(chunk.section(), 512)
                        || !text(chunk.version(), 80) || !text(chunk.text(), 16384)
                        || !text(chunk.source(), 1000)
                        || chunk.sourceSha256() == null || !chunk.sourceSha256().matches("[a-f0-9]{64}")
                        || !Double.isFinite(chunk.score()) || chunk.score() < -1.001 || chunk.score() > 1.001
                        || chunk.score() > previous || chunk.tokenCount() < 1
                        || chunk.tokenCount() > result.contextTokens()
                        || (!input.sourceIds().isEmpty() && !input.sourceIds().contains(chunk.sourceId()))
                        || (!input.documentIds().isEmpty() && !input.documentIds().contains(chunk.documentId()))) return false;
                URI source = URI.create(chunk.source());
                if (!Set.of("https", "repo").contains(source.getScheme()) || source.getHost() == null
                        || source.getUserInfo() != null || source.getQuery() != null) return false;
                Instant.parse(chunk.ingestionTimestamp());
                previous = chunk.score();
            }
            return true;
        } catch (Exception ignored) { return false; }
    }
    private static boolean text(String value, int max) {
        return value != null && !value.isBlank() && value.codePointCount(0, value.length()) <= max;
    }
    private static boolean uuid(String value) {
        return value != null && value.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}");
    }
    @PreDestroy public void close() { http.shutdownNow(); }
    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final int limit;
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private Flow.Subscription subscription;
        LimitedBody(int limit) { this.limit = limit; }
        @Override public CompletionStage<byte[]> getBody() { return result; }
        @Override public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
        @Override public void onNext(List<ByteBuffer> items) {
            for (ByteBuffer item : items) {
                if (bytes.size() + item.remaining() > limit) {
                    subscription.cancel();
                    result.completeExceptionally(new IllegalStateException("RAG response exceeds limit"));
                    return;
                }
                byte[] part = new byte[item.remaining()]; item.get(part); bytes.writeBytes(part);
            }
            subscription.request(1);
        }
        @Override public void onError(Throwable error) { result.completeExceptionally(error); }
        @Override public void onComplete() { result.complete(bytes.toByteArray()); }
    }
}
