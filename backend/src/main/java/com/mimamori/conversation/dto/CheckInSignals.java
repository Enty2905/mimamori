package com.mimamori.conversation.dto;

import com.mimamori.common.ApiException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Stable wire values; legacy labels are normalized so installed ja/vi clients stay safe. */
public final class CheckInSignals {
    private CheckInSignals() {}
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("Vui vẻ", "GOOD"), Map.entry("Bình thường", "NORMAL"),
            Map.entry("Hơi mệt", "TIRED"), Map.entry("Buồn bã", "POOR"),
            Map.entry("Rất khỏe", "GOOD"), Map.entry("Đau nhức", "PAIN"), Map.entry("Chóng mặt", "DIZZY"),
            Map.entry("Ngủ rất ngon", "GOOD"), Map.entry("Đủ giấc", "NORMAL"),
            Map.entry("Chập chờn", "POOR"), Map.entry("Mất ngủ", "INSOMNIA"),
            Map.entry("Ngon miệng", "GOOD"), Map.entry("Ăn ít", "POOR"), Map.entry("Chán ăn", "POOR"),
            Map.entry("元気", "GOOD"), Map.entry("普通", "NORMAL"), Map.entry("疲れた", "TIRED"),
            Map.entry("痛み", "PAIN"), Map.entry("めまい", "DIZZY"), Map.entry("眠れない", "INSOMNIA"));

    public static String normalize(String value, String field) {
        if (value == null) throw new ApiException(400, "Missing check-in signal: " + field);
        String result = ALIASES.getOrDefault(value.strip(), value.strip().toUpperCase(Locale.ROOT));
        if ("OKAY".equals(result) || "EXCELLENT".equals(result)) result = "OKAY".equals(result) ? "NORMAL" : "GOOD";
        Set<String> allowed = switch (field) {
            case "mood" -> Set.of("GOOD", "NORMAL", "TIRED", "POOR");
            case "physicalHealth" -> Set.of("GOOD", "NORMAL", "TIRED", "PAIN", "DIZZY");
            case "sleepQuality" -> Set.of("GOOD", "NORMAL", "POOR", "INSOMNIA");
            case "appetite" -> Set.of("GOOD", "NORMAL", "POOR");
            default -> Set.of();
        };
        if (!allowed.contains(result)) throw new ApiException(400, "Invalid check-in signal: " + field);
        return result;
    }
}
