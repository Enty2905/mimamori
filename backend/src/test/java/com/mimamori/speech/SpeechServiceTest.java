package com.mimamori.speech;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mimamori.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SpeechServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private SpeechService createService(RestClient.Builder builder) {
        return new SpeechService(
                builder.build(),
                "test-groq-key",
                "whisper-large-v3-turbo",
                "whisper-large-v3",
                objectMapper
        );
    }

    @Test
    void rejectsNullOrEmptyAudio() {
        SpeechService service = createService(RestClient.builder().baseUrl("https://api.groq.com/openai/v1"));

        ApiException nullEx = assertThrows(ApiException.class, () -> service.transcribe(null, "vi"));
        assertEquals(400, nullEx.getStatus());

        MockMultipartFile emptyFile = new MockMultipartFile("audio", "voice.m4a", "audio/m4a", new byte[0]);
        ApiException emptyEx = assertThrows(ApiException.class, () -> service.transcribe(emptyFile, "vi"));
        assertEquals(400, emptyEx.getStatus());
    }

    @Test
    void rejectsOversizedAudioOver10Mb() {
        SpeechService service = createService(RestClient.builder().baseUrl("https://api.groq.com/openai/v1"));
        byte[] oversized = new byte[(int) SpeechService.MAX_FILE_SIZE_BYTES + 1];
        MockMultipartFile file = new MockMultipartFile("audio", "voice.m4a", "audio/m4a", oversized);

        ApiException ex = assertThrows(ApiException.class, () -> service.transcribe(file, "vi"));
        assertEquals(413, ex.getStatus());
    }

    @Test
    void rejectsUnsupportedExtensionOrContentType() {
        SpeechService service = createService(RestClient.builder().baseUrl("https://api.groq.com/openai/v1"));
        MockMultipartFile textFile = new MockMultipartFile(
                "audio",
                "notes.txt",
                "text/plain",
                "hello".getBytes(StandardCharsets.UTF_8)
        );

        ApiException ex = assertThrows(ApiException.class, () -> service.transcribe(textFile, "vi"));
        assertEquals(400, ex.getStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"m4a", "mp4", "aac", "wav", "mp3", "webm", "ogg", "3gp"})
    void acceptsAllowedAudioExtensionsAndTranscribedText(String ext) {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SpeechService service = createService(builder);

        server.expect(requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"text\":\"Hôm nay bác khỏe không\"}", MediaType.APPLICATION_JSON));

        MockMultipartFile audioFile = new MockMultipartFile(
                "audio",
                "voice." + ext,
                "application/octet-stream",
                new byte[]{1, 2, 3, 4}
        );

        SpeechTranscriptionResponse response = service.transcribe(audioFile, null);
        assertEquals("Hôm nay bác khỏe không", response.getText());
        assertEquals("vi", response.getLanguage());
        assertEquals("whisper-large-v3-turbo", response.getModel());
        server.verify();
    }

    @Test
    void fallsBackToWhisperLargeV3OnRateLimit() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SpeechService service = createService(builder);

        server.expect(requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andRespond(withSuccess("{\"text\":\"Cháu chào bác\"}", MediaType.APPLICATION_JSON));

        MockMultipartFile audioFile = new MockMultipartFile("audio", "voice.m4a", "audio/m4a", new byte[]{1, 2, 3});
        SpeechTranscriptionResponse response = service.transcribe(audioFile, "vi");

        assertEquals("Cháu chào bác", response.getText());
        assertEquals("whisper-large-v3", response.getModel());
        server.verify();
    }

    @Test
    void throwsVietnamese429WhenAllModelsRateLimited() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SpeechService service = createService(builder);

        server.expect(times(2), requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        MockMultipartFile audioFile = new MockMultipartFile("audio", "voice.m4a", "audio/m4a", new byte[]{1, 2, 3});
        ApiException ex = assertThrows(ApiException.class, () -> service.transcribe(audioFile, "vi"));
        assertEquals(429, ex.getStatus());
        server.verify();
    }

    @Test
    void throwsVietnamese504OnTimeout() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SpeechService service = createService(builder);

        server.expect(times(2), requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        MockMultipartFile audioFile = new MockMultipartFile("audio", "voice.m4a", "audio/m4a", new byte[]{1, 2, 3});
        ApiException ex = assertThrows(ApiException.class, () -> service.transcribe(audioFile, "vi"));
        assertEquals(504, ex.getStatus());
        server.verify();
    }

    @Test
    void throwsVietnamese422WhenTranscriptionIsBlank() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SpeechService service = createService(builder);

        server.expect(times(2), requestTo("https://api.groq.com/openai/v1/audio/transcriptions"))
                .andRespond(withSuccess("{\"text\":\"   \"}", MediaType.APPLICATION_JSON));

        MockMultipartFile audioFile = new MockMultipartFile("audio", "voice.wav", "audio/wav", new byte[]{1, 2, 3});
        ApiException ex = assertThrows(ApiException.class, () -> service.transcribe(audioFile, "vi"));
        assertEquals(422, ex.getStatus());
        server.verify();
    }
}
