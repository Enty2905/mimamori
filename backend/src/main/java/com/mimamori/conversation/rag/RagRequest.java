package com.mimamori.conversation.rag;
import java.util.List;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record RagRequest(String query, String language, int topK, int maxContextTokens,
                         List<String> sourceIds, List<String> documentIds) {
    public RagRequest {
        sourceIds = sourceIds == null ? List.of() : List.copyOf(sourceIds);
        documentIds = documentIds == null ? List.of() : List.copyOf(documentIds);
    }
    public static RagRequest of(String query, String language) {
        return new RagRequest(query, language, 3, 384, List.of(), List.of());
    }
    @Override public String toString() { return "RagRequest[redacted]"; }
}
