package com.mimamori.speech;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mimamori.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Privacy-first Speech-to-Text service that forwards in-memory audio bytes
 * directly to Groq Whisper without persisting audio files to disk or database.
 */
@Service
public class SpeechService {

    private static final Logger log = LoggerFactory.getLogger(SpeechService.class);

    static final long MAX_FILE_SIZE_BYTES = 10L * 1024L * 1024L;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "m4a", "mp4", "aac", "wav", "mp3", "webm", "ogg", "3gp"
    );

    private static final Map<String, String> MIME_TO_EXTENSION = Map.ofEntries(
            Map.entry("audio/m4a", "m4a"),
            Map.entry("audio/x-m4a", "m4a"),
            Map.entry("audio/mp4", "mp4"),
            Map.entry("video/mp4", "mp4"),
            Map.entry("audio/aac", "aac"),
            Map.entry("audio/x-aac", "aac"),
            Map.entry("audio/wav", "wav"),
            Map.entry("audio/x-wav", "wav"),
            Map.entry("audio/wave", "wav"),
            Map.entry("audio/vnd.wave", "wav"),
            Map.entry("audio/mpeg", "mp3"),
            Map.entry("audio/mp3", "mp3"),
            Map.entry("audio/webm", "webm"),
            Map.entry("video/webm", "webm"),
            Map.entry("audio/ogg", "ogg"),
            Map.entry("application/ogg", "ogg"),
            Map.entry("audio/3gpp", "3gp"),
            Map.entry("video/3gpp", "3gp"),
            Map.entry("audio/3gp", "3gp")
    );

    private static final Map<String, MediaType> EXTENSION_MEDIA_TYPES = Map.of(
            "m4a", MediaType.parseMediaType("audio/mp4"),
            "mp4", MediaType.parseMediaType("audio/mp4"),
            "aac", MediaType.parseMediaType("audio/aac"),
            "wav", MediaType.parseMediaType("audio/wav"),
            "mp3", MediaType.parseMediaType("audio/mpeg"),
            "webm", MediaType.parseMediaType("audio/webm"),
            "ogg", MediaType.parseMediaType("audio/ogg"),
            "3gp", MediaType.parseMediaType("audio/3gpp")
    );

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String primaryWhisperModel;
    private final String fallbackWhisperModel;

    @Autowired
    public SpeechService(
            @Value("${mimamori.groq.base-url:https://api.groq.com/openai/v1}") String baseUrl,
            @Value("${mimamori.groq.api-key:}") String apiKey,
            @Value("${mimamori.groq.whisper-model:whisper-large-v3-turbo}") String primaryWhisperModel,
            @Value("${mimamori.groq.whisper-fallback-model:whisper-large-v3}") String fallbackWhisperModel,
            ObjectMapper objectMapper) {
        this(
                buildDefaultRestClient(baseUrl, apiKey),
                apiKey,
                primaryWhisperModel,
                fallbackWhisperModel,
                objectMapper
        );
    }

    SpeechService(
            RestClient restClient,
            String apiKey,
            String primaryWhisperModel,
            String fallbackWhisperModel,
            ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.apiKey = apiKey;
        this.primaryWhisperModel = primaryWhisperModel;
        this.fallbackWhisperModel = fallbackWhisperModel;
        this.objectMapper = objectMapper;
    }

    private static RestClient buildDefaultRestClient(String baseUrl, String apiKey) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(20));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory);
        if (apiKey != null && !apiKey.isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.trim());
        }
        return builder.build();
    }

    /**
     * Validate and transcribe an uploaded audio clip in-memory using Groq Whisper.
     */
    public SpeechTranscriptionResponse transcribe(MultipartFile audio, String language) {
        if (audio == null || audio.isEmpty()) {
            throw new ApiException(400, "Không nhận được dữ liệu âm thanh. Bác vui lòng ghi âm lại nhé.");
        }

        if (audio.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ApiException(413, "Tệp âm thanh vượt quá dung lượng tối đa 10MB.");
        }

        String extension = validateAndResolveExtension(audio);
        byte[] audioBytes = readAudioBytesInMemory(audio);
        if (audioBytes.length == 0) {
            throw new ApiException(400, "Tệp âm thanh trống. Bác vui lòng ghi âm lại nhé.");
        }
        if (audioBytes.length > MAX_FILE_SIZE_BYTES) {
            throw new ApiException(413, "Tệp âm thanh vượt quá dung lượng tối đa 10MB.");
        }

        if (apiKey == null || apiKey.isBlank()) {
            throw new ApiException(503, "Dịch vụ nhận diện giọng nói hiện chưa được cấu hình.");
        }

        String normalizedLanguage = normalizeLanguage(language);
        String safeFilename = "recording." + extension;
        MediaType partMediaType = resolveMediaType(audio.getContentType(), extension);

        Set<String> modelsToTry = new LinkedHashSet<>();
        if (primaryWhisperModel != null && !primaryWhisperModel.isBlank()) {
            modelsToTry.add(primaryWhisperModel.trim());
        }
        if (fallbackWhisperModel != null && !fallbackWhisperModel.isBlank()) {
            modelsToTry.add(fallbackWhisperModel.trim());
        }
        if (modelsToTry.isEmpty()) {
            modelsToTry.add("whisper-large-v3-turbo");
            modelsToTry.add("whisper-large-v3");
        }

        ApiException lastFailure = null;
        boolean sawBlankTranscript = false;

        for (String model : modelsToTry) {
            try {
                String text = callGroqWhisper(model, audioBytes, safeFilename, partMediaType, normalizedLanguage);
                if (text != null && !text.isBlank()) {
                    return new SpeechTranscriptionResponse(text.trim(), normalizedLanguage, model);
                }
                sawBlankTranscript = true;
            } catch (ApiException ex) {
                if (ex.getStatus() == 400 || ex.getStatus() == 413 || ex.getStatus() == 503) {
                    throw ex;
                }
                lastFailure = ex;
            }
        }

        if (sawBlankTranscript && lastFailure == null) {
            throw new ApiException(422, "Không nghe rõ giọng nói trong đoạn ghi âm. Bác vui lòng nói rõ hơn và thử lại ạ.");
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        throw new ApiException(422, "Không nghe rõ giọng nói trong đoạn ghi âm. Bác vui lòng nói rõ hơn và thử lại ạ.");
    }

    private String callGroqWhisper(
            String model,
            byte[] audioBytes,
            String filename,
            MediaType partMediaType,
            String language) {
        ByteArrayResource audioResource = new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };

        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(partMediaType);
        HttpEntity<ByteArrayResource> filePart = new HttpEntity<>(audioResource, fileHeaders);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", filePart);
        body.add("model", model);
        body.add("language", language);
        body.add("response_format", "json");

        try {
            String responseJson = restClient.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (responseJson == null || responseJson.isBlank()) {
                return null;
            }
            JsonNode root = objectMapper.readTree(responseJson);
            return root.path("text").asText("");
        } catch (HttpClientErrorException e) {
            int statusCode = e.getStatusCode().value();
            log.warn("Groq Whisper client error with model {} (status {}): {}", model, statusCode, e.getMessage());
            if (statusCode == HttpStatus.TOO_MANY_REQUESTS.value()) {
                throw new ApiException(429, "Hệ thống nhận diện giọng nói đang bận, bác vui lòng thử lại sau ít giây nhé.");
            }
            if (statusCode == 413) {
                throw new ApiException(413, "Tệp âm thanh vượt quá dung lượng cho phép.");
            }
            if (statusCode == HttpStatus.UNAUTHORIZED.value() || statusCode == HttpStatus.FORBIDDEN.value()) {
                throw new ApiException(503, "Dịch vụ nhận diện giọng nói đang gặp lỗi xác thực. Vui lòng thử lại sau.");
            }
            if (statusCode == HttpStatus.BAD_REQUEST.value()) {
                throw new ApiException(400, "Đoạn âm thanh không hợp lệ hoặc quá ngắn. Bác vui lòng ghi âm lại nhé.");
            }
            throw new ApiException(502, "Không thể xử lý yêu cầu nhận diện giọng nói lúc này. Bác vui lòng thử lại sau nhé.");
        } catch (HttpServerErrorException e) {
            log.warn("Groq Whisper server error with model {} (status {}): {}", model, e.getStatusCode().value(), e.getMessage());
            throw new ApiException(502, "Dịch vụ nhận diện giọng nói tạm thời gián đoạn. Bác vui lòng thử lại sau nhé.");
        } catch (ResourceAccessException e) {
            log.warn("Groq Whisper network/timeout error with model {}: {}", model, e.getMessage());
            if (isTimeoutException(e)) {
                throw new ApiException(504, "Kết nối nhận diện giọng nói bị quá thời gian. Bác vui lòng kiểm tra mạng và thử lại ạ.");
            }
            throw new ApiException(502, "Không thể kết nối dịch vụ nhận diện giọng nói lúc này. Bác vui lòng thử lại sau nhé.");
        } catch (Exception e) {
            log.warn("Unexpected error during Groq Whisper transcription with model {}: {}", model, e.getMessage());
            throw new ApiException(502, "Có lỗi xảy ra khi chuyển giọng nói thành văn bản. Bác vui lòng thử lại nhé.");
        }
    }

    private byte[] readAudioBytesInMemory(MultipartFile audio) {
        try {
            return audio.getBytes();
        } catch (IOException e) {
            throw new ApiException(400, "Không thể đọc dữ liệu âm thanh. Vui lòng thử ghi âm lại.");
        }
    }

    private String validateAndResolveExtension(MultipartFile audio) {
        String filenameExt = extractExtension(audio.getOriginalFilename());
        String normalizedMime = normalizeMimeType(audio.getContentType());

        if (filenameExt != null) {
            if (!ALLOWED_EXTENSIONS.contains(filenameExt)) {
                throw new ApiException(400,
                        "Định dạng âm thanh không được hỗ trợ. Vui lòng sử dụng m4a, mp4, aac, wav, mp3, webm, ogg hoặc 3gp.");
            }
            if (normalizedMime != null
                    && !"application/octet-stream".equals(normalizedMime)
                    && !MIME_TO_EXTENSION.containsKey(normalizedMime)
                    && !normalizedMime.startsWith("audio/")) {
                throw new ApiException(400,
                        "Loại tệp âm thanh không hợp lệ. Vui lòng sử dụng m4a, mp4, aac, wav, mp3, webm, ogg hoặc 3gp.");
            }
            return filenameExt;
        }

        if (normalizedMime != null && MIME_TO_EXTENSION.containsKey(normalizedMime)) {
            return MIME_TO_EXTENSION.get(normalizedMime);
        }

        throw new ApiException(400,
                "Định dạng âm thanh không được hỗ trợ. Vui lòng sử dụng m4a, mp4, aac, wav, mp3, webm, ogg hoặc 3gp.");
    }

    private static String extractExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return null;
        }
        int lastSlash = Math.max(originalFilename.lastIndexOf('/'), originalFilename.lastIndexOf('\\'));
        String baseName = lastSlash >= 0 ? originalFilename.substring(lastSlash + 1) : originalFilename;
        int dotIndex = baseName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == baseName.length() - 1) {
            return null;
        }
        return baseName.substring(dotIndex + 1).trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeMimeType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        int semicolon = contentType.indexOf(';');
        String base = semicolon >= 0 ? contentType.substring(0, semicolon) : contentType;
        String trimmed = base.trim().toLowerCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static MediaType resolveMediaType(String rawContentType, String extension) {
        String normalizedMime = normalizeMimeType(rawContentType);
        if (normalizedMime != null && (normalizedMime.startsWith("audio/")
                || normalizedMime.startsWith("video/")
                || "application/ogg".equals(normalizedMime))) {
            try {
                return MediaType.parseMediaType(normalizedMime);
            } catch (InvalidMediaTypeException ignored) {
                // Fall back to extension mapping below
            }
        }
        return EXTENSION_MEDIA_TYPES.getOrDefault(extension, MediaType.APPLICATION_OCTET_STREAM);
    }

    private static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) {
            return "vi";
        }
        return language.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isTimeoutException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof HttpTimeoutException || current instanceof SocketTimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
