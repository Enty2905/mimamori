package com.mimamori.conversation.rag;
import java.util.List;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record RagContext(int schemaVersion, String status, String reason, String pipelineId,
                         int contextTokens, List<Chunk> chunks) {
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Chunk(String chunkId, String documentId, String sourceId, String source,
                        String title, String section, String language, String version,
                        String ingestionTimestamp, String text, double score,
                        int tokenCount, String sourceSha256) {
        @Override public String toString() { return "RagChunk[redacted]"; }
    }
    public static RagContext empty(String reason) {
        return new RagContext(1, "no_context", reason, null, 0, List.of());
    }
    public boolean hasContext() { return "context".equals(status); }
    @Override public String toString() { return "RagContext[status=" + status + ", reason=" + reason + "]"; }
}
