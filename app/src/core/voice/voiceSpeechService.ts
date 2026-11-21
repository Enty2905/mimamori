import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export const DEFAULT_SPEECH_RATE = 0.9;
const MIN_SPEECH_RATE = 0.5;
const MAX_SPEECH_RATE = 1.5;
const ANDROID_SAFE_CHUNK_LIMIT = 3500;

export interface UseVoiceSynthesisResult {
  availableVietnameseVoices: Speech.Voice[];
  selectedVoiceIdentifier: string | null;
  setSelectedVoiceIdentifier: (identifier: string | null) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speakingMessageId: string | null;
  isSpeaking: boolean;
  isPaused: boolean;
  hasVietnameseVoice: boolean;
  ttsError: string | null;
  speakMessage: (messageId: string, text: string, onComplete?: () => void) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  replay: (messageId: string, text: string, onComplete?: () => void) => Promise<void>;
  refreshVoices: () => Promise<Speech.Voice[]>;
}

/**
 * Strips common markdown formatting so TTS reads natural Vietnamese prose.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function splitChunkByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    let splitAt = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '), slice.lastIndexOf(' '));
    if (splitAt <= Math.floor(maxLength * 0.4)) {
      splitAt = maxLength;
    }
    const head = remaining.slice(0, splitAt).trim();
    if (head) {
      chunks.push(head);
    }
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

/**
 * Splits long text into sentence-level chunks while staying under platform limits.
 */
export function splitTextIntoSentences(
  text: string,
  maxLength = ANDROID_SAFE_CHUNK_LIMIT
): string[] {
  const cleaned = sanitizeTextForSpeech(text);
  if (!cleaned) {
    return [];
  }

  const rawMatches = cleaned.match(/[^.!?\n…]+(?:[.!?\n…]+|$)/g) ?? [cleaned];
  const sentences: string[] = [];

  for (const part of rawMatches) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    sentences.push(...splitChunkByLength(trimmed, maxLength));
  }

  return sentences;
}

function scoreVietnameseVoice(voice: Speech.Voice): number {
  const lang = (voice.language || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();
  const id = (voice.identifier || '').toLowerCase();

  let score = 0;
  if (lang === 'vi-vn' || lang === 'vi_vn') {
    score += 100;
  } else if (lang.startsWith('vi')) {
    score += 60;
  }

  if (voice.quality === Speech.VoiceQuality.Enhanced || String(voice.quality) === 'Enhanced') {
    score += 30;
  }

  // Prefer natural/local high-clarity voices when available
  if (name.includes('linh') || name.includes('an') || name.includes('vietnam')) {
    score += 10;
  }
  if (id.includes('network') || name.includes('natural')) {
    score += 5;
  }

  return score;
}

/**
 * Filters and ranks Vietnamese voices, returning the sorted list and clearest default identifier.
 */
export function selectBestVietnameseVoice(voices: Speech.Voice[]): {
  vietnameseVoices: Speech.Voice[];
  bestIdentifier: string | null;
} {
  const vietnameseVoices = voices
    .filter((voice) => (voice.language || '').toLowerCase().startsWith('vi'))
    .sort((a, b) => scoreVietnameseVoice(b) - scoreVietnameseVoice(a));

  return {
    vietnameseVoices,
    bestIdentifier: vietnameseVoices[0]?.identifier ?? null,
  };
}

function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_SPEECH_RATE;
  return Math.max(MIN_SPEECH_RATE, Math.min(MAX_SPEECH_RATE, rate));
}

export function useVoiceSynthesis(): UseVoiceSynthesisResult {
  const [availableVietnameseVoices, setAvailableVietnameseVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoiceIdentifier, setSelectedVoiceIdentifier] = useState<string | null>(null);
  const [speechRate, setSpeechRateState] = useState<number>(DEFAULT_SPEECH_RATE);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const sessionCounterRef = useRef(0);
  const sentencesRef = useRef<string[]>([]);
  const sentenceIndexRef = useRef(0);
  const activeMessageIdRef = useRef<string | null>(null);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);
  const selectedVoiceRef = useRef<string | null>(null);
  const speechRateRef = useRef<number>(DEFAULT_SPEECH_RATE);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoiceIdentifier;
  }, [selectedVoiceIdentifier]);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  const setSelectedVoice = useCallback((identifier: string | null) => {
    selectedVoiceRef.current = identifier;
    setSelectedVoiceIdentifier(identifier);
  }, []);

  const setSpeechRate = useCallback((rate: number) => {
    const clamped = clampSpeechRate(rate);
    speechRateRef.current = clamped;
    setSpeechRateState(clamped);
  }, []);

  const refreshVoices = useCallback(async (): Promise<Speech.Voice[]> => {
    try {
      const allVoices = await Speech.getAvailableVoicesAsync();
      if (!mountedRef.current) return [];

      const { vietnameseVoices, bestIdentifier } = selectBestVietnameseVoice(allVoices);
      setAvailableVietnameseVoices(vietnameseVoices);
      setSelectedVoiceIdentifier((prev) => {
        if (prev && vietnameseVoices.some((v) => v.identifier === prev)) {
          return prev;
        }
        return bestIdentifier;
      });
      return vietnameseVoices;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshVoices();

    return () => {
      mountedRef.current = false;
      sessionCounterRef.current += 1;
      onCompleteRef.current = undefined;
      sentencesRef.current = [];
      sentenceIndexRef.current = 0;
      activeMessageIdRef.current = null;
      void Speech.stop().catch(() => {});
    };
  }, [refreshVoices]);

  const resetPlaybackState = useCallback(() => {
    activeMessageIdRef.current = null;
    sentencesRef.current = [];
    sentenceIndexRef.current = 0;
    onCompleteRef.current = undefined;
    if (mountedRef.current) {
      setSpeakingMessageId(null);
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  const speakChunkAt = useCallback(
    (startIndex: number, sessionId: number) => {
      const runChunk = (index: number) => {
        if (!mountedRef.current || sessionCounterRef.current !== sessionId) {
          return;
        }

        const chunks = sentencesRef.current;
        if (index < 0 || index >= chunks.length) {
          const doneCb = onCompleteRef.current;
          resetPlaybackState();
          doneCb?.();
          return;
        }

        sentenceIndexRef.current = index;
        const chunk = chunks[index];

        const options: Speech.SpeechOptions = {
          language: 'vi-VN',
          rate: speechRateRef.current,
          pitch: 1.0,
          volume: 1.0,
          ...(selectedVoiceRef.current ? { voice: selectedVoiceRef.current } : {}),
          onStart: () => {
            if (!mountedRef.current || sessionCounterRef.current !== sessionId) return;
            setIsSpeaking(true);
            setIsPaused(false);
            setTtsError(null);
          },
          onDone: () => {
            if (!mountedRef.current || sessionCounterRef.current !== sessionId) return;
            const nextIndex = index + 1;
            if (nextIndex < chunks.length) {
              runChunk(nextIndex);
            } else {
              const doneCb = onCompleteRef.current;
              resetPlaybackState();
              doneCb?.();
            }
          },
          onStopped: () => {
            if (!mountedRef.current || sessionCounterRef.current !== sessionId) return;
            resetPlaybackState();
          },
          onError: () => {
            if (!mountedRef.current || sessionCounterRef.current !== sessionId) return;
            resetPlaybackState();
            setTtsError(
              'Chưa thể phát giọng nói lúc này. Ông/bà kiểm tra âm lượng thiết bị giúp cháu nhé.'
            );
          },
        };

        try {
          Speech.speak(chunk, options);
        } catch {
          if (mountedRef.current && sessionCounterRef.current === sessionId) {
            resetPlaybackState();
            setTtsError('Thiết bị chưa sẵn sàng phát giọng nói tiếng Việt.');
          }
        }
      };

      runChunk(startIndex);
    },
    [resetPlaybackState]
  );

  const speakMessage = useCallback(
    async (messageId: string, text: string, onComplete?: () => void): Promise<void> => {
      const platformLimit =
        Platform.OS === 'android'
          ? Math.min(ANDROID_SAFE_CHUNK_LIMIT, Speech.maxSpeechInputLength || ANDROID_SAFE_CHUNK_LIMIT)
          : Speech.maxSpeechInputLength || Number.MAX_SAFE_INTEGER;

      const chunks =
        Platform.OS === 'android'
          ? splitTextIntoSentences(text, platformLimit)
          : (() => {
              const cleaned = sanitizeTextForSpeech(text);
              if (!cleaned) return [];
              if (cleaned.length <= platformLimit) return [cleaned];
              return splitTextIntoSentences(cleaned, platformLimit);
            })();

      if (chunks.length === 0) {
        return;
      }

      // Invalidate any previous utterance callbacks before stopping
      const sessionId = ++sessionCounterRef.current;
      try {
        await Speech.stop();
      } catch {
        // Ignore stop failures from idle state
      }

      if (!mountedRef.current || sessionCounterRef.current !== sessionId) {
        return;
      }

      if (availableVietnameseVoices.length === 0) {
        void refreshVoices();
      }

      activeMessageIdRef.current = messageId;
      sentencesRef.current = chunks;
      sentenceIndexRef.current = 0;
      onCompleteRef.current = onComplete;

      setTtsError(null);
      setSpeakingMessageId(messageId);
      setIsSpeaking(true);
      setIsPaused(false);

      speakChunkAt(0, sessionId);
    },
    [availableVietnameseVoices.length, refreshVoices, speakChunkAt]
  );

  const pause = useCallback(async (): Promise<void> => {
    if (!activeMessageIdRef.current || isPaused || !isSpeaking) {
      return;
    }

    if (Platform.OS === 'android') {
      // Android Speech.pause() is unsupported: invalidate current callbacks,
      // stop TTS, and keep sentenceIndexRef so resume() continues cleanly.
      sessionCounterRef.current += 1;
      if (mountedRef.current) {
        setIsPaused(true);
        setIsSpeaking(false);
      }
      try {
        await Speech.stop();
      } catch {
        // Ignore
      }
      return;
    }

    try {
      await Speech.pause();
      if (mountedRef.current) {
        setIsPaused(true);
        setIsSpeaking(false);
      }
    } catch {
      if (mountedRef.current) {
        setTtsError('Không thể tạm dừng giọng đọc trên thiết bị này.');
      }
    }
  }, [isPaused, isSpeaking]);

  const resume = useCallback(async (): Promise<void> => {
    if (!activeMessageIdRef.current || !isPaused) {
      return;
    }

    if (Platform.OS === 'android') {
      const resumeIndex = Math.min(
        sentenceIndexRef.current,
        Math.max(0, sentencesRef.current.length - 1)
      );
      if (sentencesRef.current.length === 0) {
        resetPlaybackState();
        return;
      }
      const sessionId = ++sessionCounterRef.current;
      if (mountedRef.current) {
        setIsPaused(false);
        setIsSpeaking(true);
        setTtsError(null);
      }
      speakChunkAt(resumeIndex, sessionId);
      return;
    }

    try {
      await Speech.resume();
      if (mountedRef.current) {
        setIsPaused(false);
        setIsSpeaking(true);
      }
    } catch {
      // Fallback: replay from current chunk if native resume fails
      if (sentencesRef.current.length > 0) {
        const sessionId = ++sessionCounterRef.current;
        if (mountedRef.current) {
          setIsPaused(false);
          setIsSpeaking(true);
        }
        speakChunkAt(sentenceIndexRef.current, sessionId);
      }
    }
  }, [isPaused, resetPlaybackState, speakChunkAt]);

  const stop = useCallback(async (): Promise<void> => {
    sessionCounterRef.current += 1;
    resetPlaybackState();
    try {
      await Speech.stop();
    } catch {
      // Ignore
    }
  }, [resetPlaybackState]);

  const replay = useCallback(
    async (messageId: string, text: string, onComplete?: () => void): Promise<void> => {
      await speakMessage(messageId, text, onComplete);
    },
    [speakMessage]
  );

  return {
    availableVietnameseVoices,
    selectedVoiceIdentifier,
    setSelectedVoiceIdentifier: setSelectedVoice,
    speechRate,
    setSpeechRate,
    speakingMessageId,
    isSpeaking,
    isPaused,
    hasVietnameseVoice: availableVietnameseVoices.length > 0,
    ttsError,
    speakMessage,
    pause,
    resume,
    stop,
    replay,
    refreshVoices,
  };
}
