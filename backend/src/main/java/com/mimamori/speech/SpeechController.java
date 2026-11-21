package com.mimamori.speech;

import com.mimamori.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/speech")
@Tag(name = "Speech to Text", description = "Privacy-first in-memory speech transcription endpoint")
public class SpeechController {

    private final SpeechService speechService;

    public SpeechController(SpeechService speechService) {
        this.speechService = speechService;
    }

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Transcribe uploaded voice audio to text without storing audio")
    public ApiResponse<SpeechTranscriptionResponse> transcribe(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "audio", required = false) MultipartFile audio,
            @RequestParam(value = "language", defaultValue = "vi") String language) {
        return ApiResponse.ok(speechService.transcribe(audio, language));
    }
}
