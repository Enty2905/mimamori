import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import { AIAvatar, type AIAvatarStatus } from '../../components/AIAvatar';
import { VoiceControlPanel } from '../../components/VoiceControlPanel';
import { useVoiceRecognition } from '../../core/voice/useVoiceRecognition';
import {
  sanitizeTextForSpeech,
  useVoiceSynthesis,
} from '../../core/voice/voiceSpeechService';

interface Message {
  id: number;
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  detectedEmotion?: string;
  isEmergency?: boolean;
}

interface Conversation {
  id: number;
  title: string;
}

const QUICK_PROMPTS = [
  'Hôm nay thời tiết thế nào cháu?',
  'Nhắc tôi nhớ uống nước ấm nhé',
  'Tôi cảm thấy hơi mỏi lưng hôm nay',
  'Kể cho tôi nghe một mẩu chuyện vui',
  'Tôi nên ăn gì để ngủ ngon hơn?',
];

const SPEECH_SPEED_OPTIONS = [
  { label: 'Chậm 0.8x', rate: 0.8 },
  { label: 'Vừa 0.9x', rate: 0.9 },
  { label: 'Nhanh 1.0x', rate: 1.0 },
];

const VOICE_TEST_SAMPLE =
  'Xin chào cụ, cháu là trợ lý Mimamori. Chúc cụ một ngày thật vui vẻ và bình an ạ.';

const EMERGENCY_KEYWORDS = [
  'đau ngực',
  'tức ngực',
  'nhói ngực',
  'đau thắt ngực',
  'nhói tim',
  'dau nguc',
  'tuc nguc',
  'khó thở',
  'ngạt thở',
  'hụt hơi',
  'kho tho',
  'ngat tho',
  'hut hoi',
  'ngất',
  'choáng',
  'xỉu',
  'bất tỉnh',
  'méo miệng',
  'liệt',
  'cấp cứu',
  'ngat',
  'xiu',
];

function isEmergencyText(text: string): boolean {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

export const ElderlyCompanionScreen: React.FC = () => {
  const { fs } = useAccessibilityStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [autoTts, setAutoTts] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const conversationRef = useRef<Conversation | null>(null);
  const autoTtsRef = useRef(autoTts);
  const continuousModeRef = useRef(continuousMode);
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const nextTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    autoTtsRef.current = autoTts;
  }, [autoTts]);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  const {
    availableVietnameseVoices,
    selectedVoiceIdentifier,
    setSelectedVoiceIdentifier,
    speechRate,
    setSpeechRate,
    speakingMessageId,
    isSpeaking,
    isPaused,
    hasVietnameseVoice,
    ttsError,
    speakMessage,
    pause: pauseSpeech,
    resume: resumeSpeech,
    stop: stopSpeech,
    replay: replaySpeech,
    refreshVoices,
  } = useVoiceSynthesis();

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const clearNextTurnTimer = useCallback(() => {
    if (nextTurnTimerRef.current !== null) {
      clearTimeout(nextTurnTimerRef.current);
      nextTurnTimerRef.current = null;
    }
  }, []);

  const scheduleNextContinuousTurn = useCallback(() => {
    clearNextTurnTimer();
    nextTurnTimerRef.current = setTimeout(() => {
      nextTurnTimerRef.current = null;
      if (!mountedRef.current || !continuousModeRef.current) return;
      if (sendingRef.current || isSpeakingRef.current || isPausedRef.current) return;
      void startListeningRef.current();
    }, 350);
  }, [clearNextTurnTimer]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);

      const tempUserMsg: Message = {
        id: Date.now(),
        sender: 'USER',
        content: text,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      setInputText('');

      let assistantMsg: Message | null = null;

      try {
        let activeConv = conversationRef.current;
        if (!activeConv) {
          const convRes = await apiClient<Conversation>('/api/conversations/active');
          if (convRes.success && convRes.data) {
            activeConv = convRes.data;
            conversationRef.current = activeConv;
            if (mountedRef.current) {
              setConversation(activeConv);
            }
          }
        }

        if (!activeConv) {
          throw new Error('Không thể kết nối cuộc trò chuyện');
        }

        const res = await apiClient<Message>(`/api/conversations/${activeConv.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: text, message: text }),
        });

        if (res.success && res.data) {
          assistantMsg = res.data;
        } else {
          throw new Error(res.message || 'Không thể nhận phản hồi');
        }
      } catch (err: unknown) {
        console.warn('AI Chat Error:', err);
        const emergency = isEmergencyText(text);
        let fallbackText =
          'Dạ cháu hiểu và luôn ở bên cạnh tâm sự cùng cụ ạ! Cụ có muốn cháu kể một câu chuyện vui hay chia sẻ thêm điều gì không ạ?';
        const lower = text.toLowerCase();

        if (emergency) {
          fallbackText =
            '⚠️ CẢNH BÁO KHẨN CẤP: Ông/bà đang có dấu hiệu đáng lo ngại (đau ngực, khó thở hoặc choáng ngất). Ông/bà hãy ngồi nghỉ ngay, đừng gắng sức, báo ngay cho người thân hoặc gọi cấp cứu 115 ngay lập tức nhé ạ!';
        } else if (lower.includes('chuyện vui') || lower.includes('kể chuyện') || lower.includes('hài')) {
          fallbackText =
            'Dạ cháu kể cụ nghe mẩu chuyện vui nhé: Có một cụ ông đi khám mắt, bác sĩ hỏi: "Cụ nhìn chữ này có rõ không?". Cụ mỉm cười: "Chữ thì hơi mờ, nhưng bác sĩ đứng bên cạnh thì cụ thấy rất tươi tỉnh!". Chúc cụ luôn vui tươi, yêu đời ạ!';
        } else if (lower.includes('thời tiết')) {
          fallbackText =
            'Dạ tiết trời hôm nay khá dễ chịu, cụ nhớ chú ý giữ ấm cơ thể khi sáng sớm hoặc chiều tối ra vườn dạo bước nhé ạ!';
        } else if (lower.includes('thuốc') || lower.includes('uống')) {
          fallbackText =
            'Dạ cụ nhớ uống thuốc đúng giờ và theo đúng chỉ dẫn của bác sĩ nhé! Cụ đã uống thuốc cữ này chưa ạ?';
        }

        assistantMsg = {
          id: Date.now() + 1,
          sender: 'ASSISTANT',
          content: fallbackText,
          createdAt: new Date().toISOString(),
          isEmergency: emergency,
        };
      } finally {
        sendingRef.current = false;
        if (mountedRef.current) {
          setSending(false);
        }
      }

      if (!mountedRef.current || !assistantMsg) {
        return;
      }

      const finalAssistantMsg = assistantMsg;
      setMessages((prev) => [...prev, finalAssistantMsg]);

      const shouldAutoSpeak = continuousModeRef.current || autoTtsRef.current;
      if (shouldAutoSpeak) {
        const speakableText = sanitizeTextForSpeech(finalAssistantMsg.content);
        if (speakableText) {
          await speakMessage(String(finalAssistantMsg.id), finalAssistantMsg.content, () => {
            if (mountedRef.current && continuousModeRef.current) {
              scheduleNextContinuousTurn();
            }
          });
        } else if (continuousModeRef.current) {
          scheduleNextContinuousTurn();
        }
      }
    },
    [scheduleNextContinuousTurn, speakMessage]
  );

  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      const cleaned = transcript.trim();
      if (!cleaned || !mountedRef.current) return;

      if (continuousModeRef.current) {
        void sendMessage(cleaned);
      } else {
        setInputText(cleaned);
      }
    },
    [sendMessage]
  );

  const {
    state: voiceState,
    interimText,
    errorMessage,
    audioLevel,
    sttEngine,
    permissionDenied,
    startListening,
    stopListening,
    cancelListening,
    resetState: resetVoiceState,
  } = useVoiceRecognition({
    lang: 'vi-VN',
    maxDurationMs: 60_000,
    onFinalTranscript: handleFinalTranscript,
  });

  // Keep ref updated for continuous mode callbacks
  const beginListening = useCallback(async () => {
    clearNextTurnTimer();
    if (sendingRef.current) return;
    if (isSpeakingRef.current || isPausedRef.current) {
      await stopSpeech();
    }
    await startListening();
  }, [clearNextTurnTimer, startListening, stopSpeech]);

  useEffect(() => {
    startListeningRef.current = beginListening;
  }, [beginListening]);

  // Reset voice state from 'recognized' back to 'idle' once continuous turn fires
  useEffect(() => {
    if (continuousMode && voiceState === 'recognized') {
      resetVoiceState();
    }
  }, [continuousMode, resetVoiceState, voiceState]);

  // Cleanly disable Continuous Voice Mode on STT errors or newly surfaced TTS errors
  const prevTtsErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const newTtsError = Boolean(ttsError && ttsError !== prevTtsErrorRef.current);
    prevTtsErrorRef.current = ttsError;

    if (continuousMode && (voiceState === 'error' || newTtsError)) {
      continuousModeRef.current = false;
      setContinuousMode(false);
      clearNextTurnTimer();
    }
  }, [clearNextTurnTimer, continuousMode, ttsError, voiceState]);

  const initConversation = useCallback(async () => {
    try {
      setLoading(true);
      const convRes = await apiClient<Conversation>('/api/conversations/active');
      if (!mountedRef.current) return;
      if (convRes.success && convRes.data) {
        conversationRef.current = convRes.data;
        setConversation(convRes.data);
        const msgRes = await apiClient<Message[]>(`/api/conversations/${convRes.data.id}/messages`);
        if (!mountedRef.current) return;
        if (msgRes.success) {
          setMessages(msgRes.data || []);
        }
      }
    } catch {
      // Handled gracefully with offline fallback on send
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void initConversation();

    return () => {
      mountedRef.current = false;
      continuousModeRef.current = false;
      clearNextTurnTimer();
    };
  }, [clearNextTurnTimer, initConversation]);

  const handleEndContinuousMode = useCallback(async () => {
    continuousModeRef.current = false;
    setContinuousMode(false);
    clearNextTurnTimer();
    await cancelListening();
    await stopSpeech();
  }, [cancelListening, clearNextTurnTimer, stopSpeech]);

  const handleToggleContinuousMode = useCallback(async () => {
    if (continuousModeRef.current) {
      await handleEndContinuousMode();
      return;
    }

    continuousModeRef.current = true;
    setContinuousMode(true);
    resetVoiceState();
    await beginListening();
  }, [beginListening, handleEndContinuousMode, resetVoiceState]);

  const handleSendInput = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || sendingRef.current) return;
    resetVoiceState();
    void sendMessage(trimmed);
  }, [inputText, resetVoiceState, sendMessage]);

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      if (sendingRef.current) return;
      resetVoiceState();
      void sendMessage(prompt);
    },
    [resetVoiceState, sendMessage]
  );

  const handleSpeakMessage = useCallback(
    async (messageId: string, content: string, isReplay = false) => {
      clearNextTurnTimer();
      if (voiceState === 'listening' || voiceState === 'recognizing') {
        await cancelListening();
      }
      const onComplete = continuousModeRef.current ? scheduleNextContinuousTurn : undefined;
      if (isReplay) {
        await replaySpeech(messageId, content, onComplete);
      } else {
        await speakMessage(messageId, content, onComplete);
      }
    },
    [cancelListening, clearNextTurnTimer, replaySpeech, scheduleNextContinuousTurn, speakMessage, voiceState]
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsVisible(true);
    void refreshVoices();
  }, [refreshVoices]);

  const handleTestVoice = useCallback(async () => {
    if (speakingMessageId === '__voice_test__' && isSpeaking) {
      await stopSpeech();
      return;
    }
    if (voiceState === 'listening' || voiceState === 'recognizing') {
      await cancelListening();
    }
    await speakMessage('__voice_test__', VOICE_TEST_SAMPLE);
  }, [cancelListening, isSpeaking, speakingMessageId, speakMessage, stopSpeech, voiceState]);

  const handleCallEmergency = useCallback(() => {
    void Linking.openURL('tel:115').catch(() => {});
  }, []);

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Derive AIAvatar status & top bar status label
  const avatarStatus: AIAvatarStatus =
    voiceState === 'listening'
      ? 'listening'
      : sending || voiceState === 'recognizing'
        ? 'thinking'
        : isSpeaking
          ? 'speaking'
          : voiceState === 'error'
            ? 'error'
            : 'idle';

  const statusText =
    voiceState === 'listening'
      ? 'Đang lắng nghe...'
      : sending || voiceState === 'recognizing'
        ? 'Đang suy nghĩ...'
        : isSpeaking
          ? 'Đang đọc câu trả lời...'
          : 'Luôn sẵn sàng lắng nghe cụ';

  const statusDotColor =
    voiceState === 'listening'
      ? colors.dangerText
      : sending || voiceState === 'recognizing'
        ? colors.warningText
        : isSpeaking
          ? colors.primary
          : voiceState === 'error'
            ? colors.dangerText
            : colors.primary;

  const isListeningOrRecognizing = voiceState === 'listening' || voiceState === 'recognizing';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      style={styles.container}
    >
      {/* Companion Bar Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarMainRow}>
          <AIAvatar size={46} status={avatarStatus} />
          <View style={styles.topBarInfo}>
            <Text style={[styles.companionName, { fontSize: fs(17) }]} numberOfLines={1}>
              Trợ lý Mimamori AI
            </Text>
            <View style={styles.onlineBadgeRow}>
              <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
              <Text
                style={[
                  styles.onlineStatusText,
                  { fontSize: fs(12.5) },
                  voiceState === 'listening' && { color: colors.dangerText, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {statusText}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cài đặt giọng nói"
          >
            <Feather name="sliders" size={19} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Action Strip: Continuous Voice Mode Toggle & Quick Prompts Toggle */}
        <View style={styles.topBarActionStrip}>
          <TouchableOpacity
            style={[
              styles.continuousModePill,
              continuousMode && styles.continuousModePillActive,
            ]}
            onPress={() => void handleToggleContinuousMode()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: continuousMode }}
            accessibilityLabel="Trò chuyện giọng nói liên tục"
          >
            <Feather
              name={continuousMode ? 'phone-off' : 'mic'}
              size={15}
              color={continuousMode ? '#FFFFFF' : colors.primary}
            />
            <Text
              style={[
                styles.continuousModePillText,
                { fontSize: fs(13) },
                continuousMode && styles.continuousModePillTextActive,
              ]}
              numberOfLines={1}
            >
              {continuousMode ? 'Kết thúc trò chuyện giọng nói' : 'Trò chuyện giọng nói'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.suggestionsTogglePill}
            onPress={() => setShowSuggestions((prev) => !prev)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={showSuggestions ? 'Quay lại khung chat' : 'Mở gợi ý câu hỏi'}
          >
            <Feather
              name={showSuggestions ? 'chevron-down' : 'help-circle'}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.suggestionsToggleText, { fontSize: fs(12.5) }]}>
              {showSuggestions ? 'Quay lại' : 'Gợi ý'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TTS Error Banner (if any) */}
      {ttsError && (
        <View style={styles.ttsErrorStrip}>
          <Feather name="volume-x" size={15} color={colors.warningText} />
          <Text style={[styles.ttsErrorText, { fontSize: fs(12.5) }]}>{ttsError}</Text>
        </View>
      )}

      {/* Messages Feed */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>
            Đang chuẩn bị cuộc trò chuyện...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyWelcome}>
              <AIAvatar size={64} status={avatarStatus} />
              <Text style={[styles.emptyWelcomeTitle, { fontSize: fs(19) }]}>Kính chào cụ!</Text>
              <Text style={[styles.emptyWelcomeSub, { fontSize: fs(14.5) }]}>
                Cháu là trợ lý Mimamori AI. Cụ có thể nhấn nút micro để nói chuyện hoặc nhắn tin về
                sức khỏe, kể chuyện vui với cháu nhé!
              </Text>
            </View>
          }
          ListFooterComponent={
            sending ? (
              <View style={[styles.messageRow, styles.aiRow]}>
                <View style={styles.aiMessageAvatar}>
                  <Feather name="smile" size={14} color={colors.primary} />
                </View>
                <View style={styles.bubbleCol}>
                  <View style={[styles.bubble, styles.aiBubble, styles.thinkingBubble]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.thinkingText, { fontSize: fs(15) }]}>
                      Mimamori đang suy nghĩ...
                    </Text>
                  </View>
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => {
            const isUser = item.sender === 'USER';
            const msgId = String(item.id);
            const timeStr = formatMessageTime(item.createdAt);
            const isThisSpeaking = speakingMessageId === msgId && isSpeaking;
            const isThisPaused = speakingMessageId === msgId && isPaused;

            return (
              <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
                {!isUser && (
                  <View style={styles.aiMessageAvatar}>
                    <Feather name="smile" size={14} color={colors.primary} />
                  </View>
                )}

                <View style={styles.bubbleCol}>
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.userBubble : styles.aiBubble,
                      item.isEmergency && styles.emergencyBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        { fontSize: fs(16) },
                        isUser ? styles.userText : styles.aiText,
                        item.isEmergency && styles.emergencyText,
                      ]}
                    >
                      {item.content}
                    </Text>

                    {item.isEmergency && (
                      <TouchableOpacity
                        style={styles.emergencyCallBtn}
                        onPress={handleCallEmergency}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Gọi cấp cứu 115"
                      >
                        <Feather name="phone-call" size={16} color="#FFFFFF" />
                        <Text style={[styles.emergencyCallText, { fontSize: fs(14) }]}>
                          Gọi cấp cứu 115
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Audio playback controls below every AI message */}
                  {!isUser && (
                    <View style={styles.aiMessageFooter}>
                      <View style={styles.ttsControlsRow}>
                        {isThisSpeaking ? (
                          <>
                            <TouchableOpacity
                              style={[styles.ttsBtn, styles.ttsBtnActive]}
                              onPress={() => void pauseSpeech()}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel="Tạm dừng đọc"
                            >
                              <Feather name="pause" size={14} color={colors.primaryDark} />
                              <Text style={[styles.ttsBtnTextActive, { fontSize: fs(13) }]}>
                                Tạm dừng
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.ttsBtn, styles.ttsBtnStop]}
                              onPress={() => void stopSpeech()}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel="Dừng đọc"
                            >
                              <Feather name="square" size={13} color={colors.dangerText} />
                              <Text style={[styles.ttsBtnTextStop, { fontSize: fs(13) }]}>
                                Dừng
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : isThisPaused ? (
                          <>
                            <TouchableOpacity
                              style={[styles.ttsBtn, styles.ttsBtnActive]}
                              onPress={() => void resumeSpeech()}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel="Tiếp tục đọc"
                            >
                              <Feather name="play" size={14} color={colors.primaryDark} />
                              <Text style={[styles.ttsBtnTextActive, { fontSize: fs(13) }]}>
                                Tiếp tục
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.ttsBtn}
                              onPress={() => void handleSpeakMessage(msgId, item.content, true)}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel="Đọc lại từ đầu"
                            >
                              <Feather name="rotate-ccw" size={13} color={colors.textSecondary} />
                              <Text style={[styles.ttsBtnText, { fontSize: fs(13) }]}>
                                Đọc lại
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={styles.ttsBtn}
                            onPress={() => void handleSpeakMessage(msgId, item.content)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Nghe câu trả lời"
                          >
                            <Feather name="volume-2" size={14} color={colors.primary} />
                            <Text style={[styles.ttsBtnText, { fontSize: fs(13) }]}>Nghe</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {timeStr ? (
                        <Text style={[styles.timestamp, { fontSize: fs(11) }]}>{timeStr}</Text>
                      ) : null}
                    </View>
                  )}

                  {isUser && timeStr ? (
                    <Text style={[styles.timestamp, styles.timeRight, { fontSize: fs(11) }]}>
                      {timeStr}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Suggested Quick Question Chips (collapsible so 360px screen stays uncluttered) */}
      {showSuggestions && !isListeningOrRecognizing && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeaderRow}>
            <Feather
              name="help-circle"
              size={13}
              color={colors.primary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.suggestionsHeader, { fontSize: fs(12) }]}>
              Gợi ý trò chuyện cùng trợ lý:
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionChip}
                onPress={() => handleQuickPrompt(prompt)}
                disabled={sending}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionChipText, { fontSize: fs(13) }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Voice Control & Input Panel (5 Voice States + Coexisting Text Input) */}
      <VoiceControlPanel
        voiceState={voiceState}
        interimText={interimText}
        errorMessage={errorMessage}
        permissionDenied={permissionDenied}
        audioLevel={audioLevel}
        sttEngine={sttEngine}
        inputText={inputText}
        onChangeInputText={setInputText}
        onSend={handleSendInput}
        sending={sending}
        continuousMode={continuousMode}
        isSpeaking={isSpeaking}
        onStartListening={() => void beginListening()}
        onStopListening={() => void stopListening()}
        onCancelListening={() => void cancelListening()}
        onRetryListening={() => void beginListening()}
        onDismissError={resetVoiceState}
        onEndContinuousMode={() => void handleEndContinuousMode()}
      />

      {/* Voice Settings Modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: fs(18) }]}>Cài đặt giọng nói</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSettingsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng cài đặt giọng nói"
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Auto-TTS Toggle */}
              <View style={styles.settingCard}>
                <View style={styles.settingSwitchRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={[styles.settingLabel, { fontSize: fs(15) }]}>
                      Tự động đọc câu trả lời
                    </Text>
                    <Text style={[styles.settingDesc, { fontSize: fs(12.5) }]}>
                      Tự động phát giọng nói mỗi khi Mimamori nhắn trả lời
                    </Text>
                  </View>
                  <Switch
                    value={autoTts}
                    onValueChange={setAutoTts}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Reading Speed */}
              <View style={styles.settingCard}>
                <Text style={[styles.settingLabel, { fontSize: fs(15), marginBottom: 10 }]}>
                  Tốc độ đọc
                </Text>
                <View style={styles.speedOptionsRow}>
                  {SPEECH_SPEED_OPTIONS.map((opt) => {
                    const selected = Math.abs(speechRate - opt.rate) < 0.03;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        style={[styles.speedOptionBtn, selected && styles.speedOptionBtnActive]}
                        onPress={() => setSpeechRate(opt.rate)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.speedOptionText,
                            { fontSize: fs(13.5) },
                            selected && styles.speedOptionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Vietnamese Voice Picker / Honest Notice */}
              <View style={styles.settingCard}>
                <Text style={[styles.settingLabel, { fontSize: fs(15), marginBottom: 8 }]}>
                  Giọng đọc tiếng Việt
                </Text>

                {!hasVietnameseVoice ? (
                  <View style={styles.noViVoiceNotice}>
                    <Feather name="info" size={16} color={colors.warningText} />
                    <Text style={[styles.noViVoiceText, { fontSize: fs(13) }]}>
                      Thiết bị hiện chưa có gói giọng đọc tiếng Việt (vi-VN). Mimamori sẽ dùng giọng
                      mặc định của hệ thống; ông/bà có thể tải thêm giọng Tiếng Việt trong Cài đặt
                      thiết bị để nghe rõ và tự nhiên hơn.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.voiceList}>
                    {availableVietnameseVoices.map((voice) => {
                      const selected = selectedVoiceIdentifier === voice.identifier;
                      const isEnhanced = String(voice.quality) === 'Enhanced';
                      return (
                        <TouchableOpacity
                          key={voice.identifier}
                          style={[styles.voiceOptionRow, selected && styles.voiceOptionRowActive]}
                          onPress={() => setSelectedVoiceIdentifier(voice.identifier)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.voiceOptionInfo}>
                            <Text style={[styles.voiceOptionName, { fontSize: fs(14) }]}>
                              {voice.name || voice.identifier}
                            </Text>
                            <Text style={[styles.voiceOptionMeta, { fontSize: fs(12) }]}>
                              {voice.language}
                              {isEnhanced ? ' • Rõ nét (Enhanced)' : ''}
                            </Text>
                          </View>
                          <Feather
                            name={selected ? 'check-circle' : 'circle'}
                            size={20}
                            color={selected ? colors.primary : colors.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Test Voice Button */}
              <TouchableOpacity
                style={styles.testVoiceBtn}
                onPress={() => void handleTestVoice()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Nghe thử giọng đọc"
              >
                <Feather
                  name={speakingMessageId === '__voice_test__' && isSpeaking ? 'square' : 'volume-2'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.testVoiceBtnText, { fontSize: fs(15) }]}>
                  {speakingMessageId === '__voice_test__' && isSpeaking ? 'Dừng nghe thử' : 'Nghe thử'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setSettingsVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalDoneBtnText, { fontSize: fs(15.5) }]}>Xong</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
    ...shadows.subtle,
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  companionName: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  onlineStatusText: {
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  settingsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  continuousModePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 16,
  },
  continuousModePillActive: {
    backgroundColor: colors.dangerText,
    borderColor: colors.dangerText,
  },
  continuousModePillText: {
    color: colors.primary,
    fontWeight: '800',
    flexShrink: 1,
  },
  continuousModePillTextActive: {
    color: '#FFFFFF',
  },
  suggestionsTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 16,
  },
  suggestionsToggleText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  ttsErrorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning,
    borderBottomWidth: 1,
    borderBottomColor: colors.warningBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ttsErrorText: {
    flex: 1,
    color: colors.warningText,
    fontWeight: '600',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyWelcome: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyWelcomeTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  emptyWelcomeSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiMessageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 24,
  },
  bubbleCol: {
    maxWidth: '83%',
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  emergencyBubble: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerBorder,
    borderWidth: 1.5,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  messageText: {
    lineHeight: 23,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiText: {
    color: colors.textPrimary,
  },
  emergencyText: {
    color: colors.dangerText,
    fontWeight: '700',
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: colors.dangerText,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  emergencyCallText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  aiMessageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginLeft: 2,
  },
  ttsControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ttsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 32,
  },
  ttsBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.successBorder,
  },
  ttsBtnStop: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerBorder,
  },
  ttsBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  ttsBtnTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  ttsBtnTextStop: {
    color: colors.dangerText,
    fontWeight: '800',
  },
  timestamp: {
    color: colors.textMuted,
  },
  timeRight: {
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceWarm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionsHeader: {
    flex: 1,
    flexShrink: 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.42)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    maxHeight: '85%',
    ...shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  settingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingTextCol: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  settingDesc: {
    color: colors.textSecondary,
    lineHeight: 18,
  },
  speedOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedOptionBtn: {
    flexGrow: 1,
    minWidth: 94,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  speedOptionBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  speedOptionText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  speedOptionTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  noViVoiceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 10,
  },
  noViVoiceText: {
    flex: 1,
    color: colors.warningText,
    lineHeight: 19,
    fontWeight: '500',
  },
  voiceList: {
    gap: 8,
  },
  voiceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceWarm,
  },
  voiceOptionRowActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  voiceOptionInfo: {
    flex: 1,
    gap: 2,
  },
  voiceOptionName: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  voiceOptionMeta: {
    color: colors.textSecondary,
  },
  testVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 16,
  },
  testVoiceBtnText: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  modalDoneBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
