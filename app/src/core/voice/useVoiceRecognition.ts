import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo';
import type { AudioRecorder, RecordingOptions, RecordingStatus } from 'expo-audio';
import type {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { apiClient } from '../api/client';

export type VoiceRecognitionState =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'recognized'
  | 'error';

export type SttEngine = 'native' | 'cloud-fallback' | 'unavailable';

export interface UseVoiceRecognitionOptions {
  lang?: string;
  maxDurationMs?: number;
  onFinalTranscript?: (text: string) => void;
}

export interface UseVoiceRecognitionResult {
  state: VoiceRecognitionState;
  interimText: string;
  recognizedText: string;
  errorMessage: string | null;
  audioLevel: number;
  sttEngine: SttEngine;
  permissionDenied: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => Promise<void>;
  resetState: () => void;
}

interface SpeechTranscriptionResponse {
  text?: string;
  transcript?: string;
  language?: string;
}

type ExpoAudioNamespace = typeof import('expo-audio');
type SpeechRecognitionModuleType = typeof ExpoSpeechRecognitionModule;

const DEFAULT_LANG = 'vi-VN';
const DEFAULT_MAX_DURATION_MS = 60_000;
const DEBOUNCE_WINDOW_MS = 350;
const METERING_POLL_MS = 100;
const MIN_AUDIO_DURATION_MS = 250;
const NATIVE_STOP_TIMEOUT_MS = 5000;
const INAUDIBLE_MESSAGE = 'Cháu chưa nghe rõ, ông/bà nói lại giúp cháu nhé.';

function loadSpeechRecognitionModule(): SpeechRecognitionModuleType | null {
  try {
    const optionalNative =
      requireOptionalNativeModule<SpeechRecognitionModuleType>('ExpoSpeechRecognition');
    if (!optionalNative) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
    return pkg.ExpoSpeechRecognitionModule ?? optionalNative;
  } catch {
    return null;
  }
}

function loadExpoAudioNamespace(): ExpoAudioNamespace | null {
  try {
    const optionalNative = requireOptionalNativeModule('ExpoAudio');
    if (!optionalNative) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-audio') as ExpoAudioNamespace;
  } catch {
    return null;
  }
}

function detectInitialEngine(
  speechModule: SpeechRecognitionModuleType | null,
  audioNamespace: ExpoAudioNamespace | null
): SttEngine {
  if (speechModule) {
    try {
      if (speechModule.isRecognitionAvailable()) {
        return 'native';
      }
    } catch {
      // Fallback to expo-audio cloud transcription if availability check fails
    }
  }
  if (audioNamespace) {
    return 'cloud-fallback';
  }
  return 'unavailable';
}

function normalizeNativeVolume(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  // expo-speech-recognition emits values in [-2, 10], where <= 0 is silent
  return Math.max(0, Math.min(1, value / 10));
}

function normalizeMeteringDb(db?: number): number {
  if (typeof db !== 'number' || Number.isNaN(db)) {
    return 0;
  }
  const clamped = Math.max(-55, Math.min(0, db));
  return (clamped + 55) / 55;
}

function mapNativeErrorToVietnamese(code: ExpoSpeechRecognitionErrorCode): string {
  switch (code) {
    case 'not-allowed':
      return 'Mimamori chưa được cấp quyền micro hoặc nhận dạng giọng nói. Ông/bà hãy bật quyền trong Cài đặt nhé.';
    case 'no-speech':
    case 'speech-timeout':
      return INAUDIBLE_MESSAGE;
    case 'network':
      return 'Kết nối mạng bị gián đoạn khi nhận dạng giọng nói. Ông/bà vui lòng thử lại nhé.';
    case 'audio-capture':
    case 'busy':
    case 'interrupted':
      return 'Micro đang bận hoặc gặp sự cố tạm thời. Ông/bà thử bấm lại nhé.';
    case 'language-not-supported':
    case 'service-not-allowed':
      return 'Thiết bị chưa bật dịch vụ nhận dạng giọng nói tiếng Việt.';
    default:
      return 'Không thể nhận dạng giọng nói lúc này. Ông/bà thử nói lại giúp cháu nhé.';
  }
}

function getAudioMimeType(uri: string): { ext: string; mimeType: string } {
  const cleanUri = uri.split('?')[0] ?? uri;
  const rawExt = cleanUri.split('.').pop()?.toLowerCase() ?? 'm4a';
  switch (rawExt) {
    case 'wav':
      return { ext: 'wav', mimeType: 'audio/wav' };
    case 'mp3':
      return { ext: 'mp3', mimeType: 'audio/mpeg' };
    case 'aac':
      return { ext: 'aac', mimeType: 'audio/aac' };
    case 'webm':
      return { ext: 'webm', mimeType: 'audio/webm' };
    case 'ogg':
      return { ext: 'ogg', mimeType: 'audio/ogg' };
    case '3gp':
      return { ext: '3gp', mimeType: 'audio/3gpp' };
    case 'mp4':
    case 'm4a':
    default:
      return { ext: rawExt || 'm4a', mimeType: 'audio/mp4' };
  }
}

export function useVoiceRecognition(
  options: UseVoiceRecognitionOptions = {}
): UseVoiceRecognitionResult {
  const { lang = DEFAULT_LANG, maxDurationMs = DEFAULT_MAX_DURATION_MS, onFinalTranscript } =
    options;

  const [{ speechModule, audioNamespace, initialEngine }] = useState(() => {
    const speech = loadSpeechRecognitionModule();
    const audio = loadExpoAudioNamespace();
    return {
      speechModule: speech,
      audioNamespace: audio,
      initialEngine: detectInitialEngine(speech, audio),
    };
  });

  const [sttEngine, setSttEngine] = useState<SttEngine>(initialEngine);
  const [state, setState] = useState<VoiceRecognitionState>('idle');
  const [interimText, setInterimText] = useState('');
  const [recognizedText, setRecognizedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mountedRef = useRef(true);
  const stateRef = useRef<VoiceRecognitionState>('idle');
  const engineRef = useRef<SttEngine>(initialEngine);
  const langRef = useRef(lang);
  const maxDurationRef = useRef(maxDurationMs);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    maxDurationRef.current = maxDurationMs;
  }, [maxDurationMs]);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    engineRef.current = sttEngine;
  }, [sttEngine]);

  const isTransitioningRef = useRef(false);
  const lastActionTimeRef = useRef(0);
  const cancelledRef = useRef(false);
  const latestInterimRef = useRef('');

  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const recorderSubRef = useRef<EventSubscription | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const stopListeningRef = useRef<() => Promise<void>>(async () => {});

  const updateState = useCallback((next: VoiceRecognitionState) => {
    stateRef.current = next;
    if (mountedRef.current) {
      setState(next);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (maxDurationTimerRef.current !== null) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (nativeStopTimerRef.current !== null) {
      clearTimeout(nativeStopTimerRef.current);
      nativeStopTimerRef.current = null;
    }
    if (meteringTimerRef.current !== null) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
    }
  }, []);

  const restoreAudioSession = useCallback(async () => {
    if (!audioNamespace) return;
    try {
      await audioNamespace.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {
      // Ignore audio mode restoration error
    }
  }, [audioNamespace]);

  const teardownRecorder = useCallback(
    async (
      stopIfRecording: boolean,
      releaseImmediately = true
    ): Promise<{ uri: string | null; durationMillis: number; release: () => void }> => {
      if (meteringTimerRef.current !== null) {
        clearInterval(meteringTimerRef.current);
        meteringTimerRef.current = null;
      }
      if (recorderSubRef.current) {
        try {
          recorderSubRef.current.remove();
        } catch {
          // Ignore
        }
        recorderSubRef.current = null;
      }

      const recorder = recorderRef.current;
      if (!recorder) {
        return { uri: null, durationMillis: 0, release: () => {} };
      }

      let durationMillis = 0;
      try {
        durationMillis = recorder.getStatus().durationMillis ?? 0;
      } catch {
        durationMillis = 0;
      }

      if (stopIfRecording) {
        try {
          await recorder.stop();
        } catch {
          // Ignore stop errors if recorder was not active
        }
      }

      const uri = recorder.uri ?? null;
      recorderRef.current = null;

      const release = () => {
        try {
          (recorder as unknown as { release?: () => void }).release?.();
        } catch {
          // Ignore release errors
        }
      };

      if (releaseImmediately) {
        release();
      }

      await restoreAudioSession();
      return { uri, durationMillis, release };
    },
    [restoreAudioSession]
  );

  const armMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current !== null) {
      clearTimeout(maxDurationTimerRef.current);
    }
    maxDurationTimerRef.current = setTimeout(() => {
      maxDurationTimerRef.current = null;
      if (stateRef.current === 'listening') {
        void stopListeningRef.current();
      }
    }, Math.max(1000, maxDurationRef.current));
  }, []);

  const finishWithSuccess = useCallback(
    (transcript: string) => {
      clearAllTimers();
      latestInterimRef.current = '';
      if (!mountedRef.current) return;
      setAudioLevel(0);
      setInterimText('');
      setRecognizedText(transcript);
      setErrorMessage(null);
      updateState('recognized');
      onFinalTranscriptRef.current?.(transcript);
    },
    [clearAllTimers, updateState]
  );

  const finishWithError = useCallback(
    (message: string, denied = false) => {
      clearAllTimers();
      latestInterimRef.current = '';
      if (!mountedRef.current) return;
      setAudioLevel(0);
      setInterimText('');
      if (denied) {
        setPermissionDenied(true);
      }
      setErrorMessage(message);
      updateState('error');
    },
    [clearAllTimers, updateState]
  );

  // Subscribe to native ExpoSpeechRecognition events when module is available
  useEffect(() => {
    if (!speechModule) return;

    const subs: EventSubscription[] = [
      speechModule.addListener('start', () => {
        if (!mountedRef.current || cancelledRef.current) return;
        if (engineRef.current === 'native') {
          updateState('listening');
        }
      }),
      speechModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
        if (!mountedRef.current || cancelledRef.current || engineRef.current !== 'native') return;
        const transcript = event.results?.[0]?.transcript?.trim() ?? '';

        if (event.isFinal) {
          if (transcript) {
            finishWithSuccess(transcript);
          } else {
            finishWithError(INAUDIBLE_MESSAGE);
          }
        } else {
          latestInterimRef.current = transcript;
          setInterimText(transcript);
        }
      }),
      speechModule.addListener('nomatch', () => {
        if (!mountedRef.current || cancelledRef.current || engineRef.current !== 'native') return;
        if (stateRef.current === 'listening' || stateRef.current === 'recognizing') {
          finishWithError(INAUDIBLE_MESSAGE);
        }
      }),
      speechModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
        if (!mountedRef.current || engineRef.current !== 'native') return;
        if (cancelledRef.current || event.error === 'aborted') {
          clearAllTimers();
          return;
        }

        if (
          (event.error === 'service-not-allowed' || event.error === 'language-not-supported') &&
          audioNamespace
        ) {
          clearAllTimers();
          setAudioLevel(0);
          setInterimText('');
          engineRef.current = 'cloud-fallback';
          setSttEngine('cloud-fallback');
          setErrorMessage(
            'Đã chuyển sang nhận dạng giọng nói trực tuyến. Ông/bà bấm lại nút micro để nói nhé.'
          );
          updateState('error');
          return;
        }

        const isDenied = event.error === 'not-allowed';
        finishWithError(mapNativeErrorToVietnamese(event.error), isDenied);
      }),
      speechModule.addListener('end', () => {
        if (!mountedRef.current || engineRef.current !== 'native') return;
        clearAllTimers();
        setAudioLevel(0);
        if (cancelledRef.current) {
          return;
        }
        if (stateRef.current === 'listening' || stateRef.current === 'recognizing') {
          const fallbackTranscript = latestInterimRef.current.trim();
          if (fallbackTranscript) {
            finishWithSuccess(fallbackTranscript);
          } else {
            finishWithError(INAUDIBLE_MESSAGE);
          }
        }
      }),
      speechModule.addListener('volumechange', (event: { value: number }) => {
        if (!mountedRef.current || cancelledRef.current || engineRef.current !== 'native') return;
        if (stateRef.current === 'listening') {
          setAudioLevel(normalizeNativeVolume(event.value));
        }
      }),
    ];

    return () => {
      for (const sub of subs) {
        try {
          sub.remove();
        } catch {
          // Ignore
        }
      }
    };
  }, [audioNamespace, clearAllTimers, finishWithError, finishWithSuccess, speechModule, updateState]);

  const cancelListening = useCallback(async (): Promise<void> => {
    cancelledRef.current = true;
    clearAllTimers();
    latestInterimRef.current = '';

    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }

    if (engineRef.current === 'native' && speechModule) {
      try {
        speechModule.abort();
      } catch {
        // Ignore
      }
    }

    await teardownRecorder(true);

    if (mountedRef.current) {
      setAudioLevel(0);
      setInterimText('');
      setErrorMessage(null);
      updateState('idle');
    }
  }, [clearAllTimers, speechModule, teardownRecorder, updateState]);

  const stopListening = useCallback(async (): Promise<void> => {
    if (stateRef.current !== 'listening' || isTransitioningRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastActionTimeRef.current < DEBOUNCE_WINDOW_MS) {
      return;
    }
    lastActionTimeRef.current = now;
    isTransitioningRef.current = true;

    try {
      clearAllTimers();
      if (mountedRef.current) {
        setAudioLevel(0);
      }

      if (engineRef.current === 'native' && speechModule) {
        updateState('recognizing');
        try {
          speechModule.stop();
        } catch {
          const fallback = latestInterimRef.current.trim();
          if (fallback) {
            finishWithSuccess(fallback);
          } else {
            finishWithError(INAUDIBLE_MESSAGE);
          }
          return;
        }

        // Guard against native recognizer hanging after stop()
        nativeStopTimerRef.current = setTimeout(() => {
          nativeStopTimerRef.current = null;
          if (!mountedRef.current || cancelledRef.current) return;
          if (stateRef.current === 'recognizing') {
            try {
              speechModule.abort();
            } catch {
              // Ignore
            }
            const fallback = latestInterimRef.current.trim();
            if (fallback) {
              finishWithSuccess(fallback);
            } else {
              finishWithError(INAUDIBLE_MESSAGE);
            }
          }
        }, NATIVE_STOP_TIMEOUT_MS);
        return;
      }

      if (engineRef.current === 'cloud-fallback') {
        updateState('recognizing');
        const { uri, durationMillis, release } = await teardownRecorder(true, false);

        if (cancelledRef.current) {
          release();
          return;
        }

        if (!uri || (durationMillis > 0 && durationMillis < MIN_AUDIO_DURATION_MS)) {
          release();
          finishWithError(INAUDIBLE_MESSAGE);
          return;
        }

        const uploadUri = uri.startsWith('/') ? `file://${uri}` : uri;
        const { ext, mimeType } = getAudioMimeType(uploadUri);
        const formData = new FormData();
        formData.append('audio', {
          uri: uploadUri,
          name: `voice_${Date.now()}.${ext}`,
          type: mimeType,
        } as unknown as Blob);

        const abortController = new AbortController();
        uploadAbortRef.current = abortController;

        try {
          const languageParam = encodeURIComponent(langRef.current.split('-')[0] || 'vi');
          const res = await apiClient<SpeechTranscriptionResponse>(
            `/api/speech/transcribe?language=${languageParam}`,
            {
              method: 'POST',
              body: formData,
              signal: abortController.signal,
              timeoutMs: 25000,
            }
          );

          if (cancelledRef.current || !mountedRef.current) {
            return;
          }

          const rawText =
            typeof res.data === 'string'
              ? res.data
              : (res.data?.text ?? res.data?.transcript ?? '');
          const cleaned = rawText.trim();

          if (!cleaned) {
            finishWithError(INAUDIBLE_MESSAGE);
          } else {
            finishWithSuccess(cleaned);
          }
        } catch (err: any) {
          if (cancelledRef.current || !mountedRef.current) {
            return;
          }
          finishWithError(
            err?.message || 'Không thể chuyển giọng nói thành văn bản. Ông/bà thử lại nhé.'
          );
        } finally {
          release();
          if (uploadAbortRef.current === abortController) {
            uploadAbortRef.current = null;
          }
        }
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, [clearAllTimers, finishWithError, finishWithSuccess, speechModule, teardownRecorder, updateState]);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  const startListening = useCallback(async (): Promise<void> => {
    if (
      isTransitioningRef.current ||
      stateRef.current === 'listening' ||
      stateRef.current === 'recognizing'
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastActionTimeRef.current < DEBOUNCE_WINDOW_MS) {
      return;
    }
    lastActionTimeRef.current = now;

    if (engineRef.current === 'unavailable') {
      finishWithError('Thiết bị hiện chưa hỗ trợ thu âm hoặc nhận dạng giọng nói.');
      return;
    }

    isTransitioningRef.current = true;
    cancelledRef.current = false;
    latestInterimRef.current = '';

    if (mountedRef.current) {
      setErrorMessage(null);
      setInterimText('');
      setRecognizedText('');
      setAudioLevel(0);
    }

    try {
      if (engineRef.current === 'native' && speechModule) {
        const currentPerm = await speechModule.getPermissionsAsync();
        const perm = currentPerm.granted ? currentPerm : await speechModule.requestPermissionsAsync();

        if (!perm.granted) {
          const msg =
            perm.canAskAgain === false
              ? 'Ứng dụng chưa được cấp quyền micro và nhận dạng giọng nói. Ông/bà hãy mở Cài đặt điện thoại để bật quyền cho Mimamori nhé.'
              : 'Mimamori cần quyền sử dụng micro để lắng nghe ông/bà nói. Ông/bà vui lòng cho phép nhé.';
          finishWithError(msg, true);
          return;
        }

        if (mountedRef.current) {
          setPermissionDenied(false);
        }

        if (cancelledRef.current) {
          return;
        }

        updateState('listening');
        armMaxDurationTimer();

        speechModule.start({
          lang: langRef.current,
          interimResults: true,
          continuous: false,
          addsPunctuation: true,
          maxAlternatives: 1,
          volumeChangeEventOptions: {
            enabled: true,
            intervalMillis: METERING_POLL_MS,
          },
        });
        return;
      }

      if (engineRef.current === 'cloud-fallback' && audioNamespace) {
        const currentPerm = await audioNamespace.getRecordingPermissionsAsync();
        const perm = currentPerm.granted
          ? currentPerm
          : await audioNamespace.requestRecordingPermissionsAsync();

        if (!perm.granted) {
          const msg =
            perm.canAskAgain === false
              ? 'Ứng dụng chưa được cấp quyền micro. Ông/bà hãy mở Cài đặt điện thoại để bật quyền micro cho Mimamori nhé.'
              : 'Mimamori cần quyền sử dụng micro để thu âm lời nói của ông/bà. Ông/bà vui lòng cho phép nhé.';
          finishWithError(msg, true);
          return;
        }

        if (mountedRef.current) {
          setPermissionDenied(false);
        }

        if (cancelledRef.current) {
          return;
        }

        await teardownRecorder(true);

        await audioNamespace.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        const recordingOptions: Partial<RecordingOptions> = {
          ...audioNamespace.RecordingPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        };

        const recorder = new audioNamespace.AudioModule.AudioRecorder(recordingOptions);
        recorderRef.current = recorder;

        recorderSubRef.current = recorder.addListener(
          'recordingStatusUpdate',
          (status: RecordingStatus) => {
            if (!mountedRef.current || cancelledRef.current) return;
            if (status.hasError) {
              void teardownRecorder(false);
              finishWithError('Micro gặp sự cố khi thu âm. Ông/bà thử lại giúp cháu nhé.');
            }
          }
        );

        await recorder.prepareToRecordAsync(recordingOptions);

        if (cancelledRef.current) {
          await teardownRecorder(false);
          return;
        }

        recorder.record({
          forDuration: Math.ceil(Math.max(1000, maxDurationRef.current) / 1000),
        });

        updateState('listening');
        armMaxDurationTimer();

        meteringTimerRef.current = setInterval(() => {
          if (!mountedRef.current || cancelledRef.current || !recorderRef.current) {
            return;
          }
          try {
            const status = recorderRef.current.getStatus();
            setAudioLevel(normalizeMeteringDb(status.metering));
          } catch {
            // Ignore metering read error
          }
        }, METERING_POLL_MS);
      }
    } catch {
      if (!cancelledRef.current) {
        await teardownRecorder(true);
        finishWithError('Không thể khởi động micro lúc này. Ông/bà vui lòng thử lại nhé.');
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, [armMaxDurationTimer, audioNamespace, finishWithError, speechModule, teardownRecorder, updateState]);

  const resetState = useCallback(() => {
    latestInterimRef.current = '';
    if (!mountedRef.current) return;
    setInterimText('');
    setRecognizedText('');
    setErrorMessage(null);
    setAudioLevel(0);
    if (stateRef.current !== 'listening' && stateRef.current !== 'recognizing') {
      updateState('idle');
    }
  }, [updateState]);

  // Auto-cancel active recording/recognition if app goes to background or screen locks
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        if (stateRef.current === 'listening' || stateRef.current === 'recognizing') {
          void cancelListening();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cancelListening]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void cancelListening();
    };
  }, [cancelListening]);

  return {
    state,
    interimText,
    recognizedText,
    errorMessage,
    audioLevel,
    sttEngine,
    permissionDenied,
    startListening,
    stopListening,
    cancelListening,
    resetState,
  };
}
