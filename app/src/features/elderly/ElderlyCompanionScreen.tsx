import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import { AIAvatar } from '../../components/AIAvatar';

interface Message {
  id: number;
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  detectedEmotion?: string;
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

export const ElderlyCompanionScreen: React.FC = () => {
  const { fs } = useAccessibilityStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const initConversation = async () => {
    try {
      setLoading(true);
      const convRes = await apiClient<Conversation>('/api/conversations/active');
      if (convRes.success && convRes.data) {
        setConversation(convRes.data);
        const msgRes = await apiClient<Message[]>(`/api/conversations/${convRes.data.id}/messages`);
        if (msgRes.success) {
          setMessages(msgRes.data || []);
        }
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initConversation();
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !conversation || sending) return;

    const tempUserMsg: Message = {
      id: Date.now(),
      sender: 'USER',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText('');
    setSending(true);

    try {
      const res = await apiClient<Message>(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text, message: text }),
      });

      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data]);
      } else {
        throw new Error(res.message || 'Không thể nhận phản hồi');
      }
    } catch (err: any) {
      console.warn('AI Chat Error:', err);
      let fallbackText =
        'Dạ cháu hiểu và luôn ở bên cạnh tâm sự cùng cụ ạ! Cụ có muốn cháu kể một câu chuyện vui hay chia sẻ thêm điều gì không ạ?';
      const lower = text.toLowerCase();
      if (lower.includes('chuyện vui') || lower.includes('kể chuyện') || lower.includes('hài')) {
        fallbackText =
          'Dạ cháu kể cụ nghe mẩu chuyện vui nhé: Có một cụ ông đi khám mắt, bác sĩ hỏi: "Cụ nhìn chữ này có rõ không?". Cụ mỉm cười: "Chữ thì hơi mờ, nhưng bác sĩ đứng bên cạnh thì cụ thấy rất tươi tỉnh!". Chúc cụ luôn vui tươi, yêu đời ạ!';
      } else if (lower.includes('thời tiết')) {
        fallbackText =
          'Dạ tiết trời hôm nay khá dễ chịu, cụ nhớ chú ý giữ ấm cơ thể khi sáng sớm hoặc chiều tối ra vườn dạo bước nhé ạ!';
      } else if (lower.includes('thuốc') || lower.includes('uống')) {
        fallbackText =
          'Dạ cụ nhớ uống thuốc đúng giờ và theo đúng chỉ dẫn của bác sĩ nhé! Cụ đã uống thuốc cữ này chưa ạ?';
      }
      const fallbackAssistantMsg: Message = {
        id: Date.now() + 1,
        sender: 'ASSISTANT',
        content: fallbackText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackAssistantMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleVoicePress = () => {
    Alert.alert(
      'Tính năng Giọng nói (Voice Assistant)',
      'Tính năng trò chuyện bằng giọng nói tiếng Việt đang được hoàn thiện và sẽ sẵn sàng trong bản cập nhật tới!',
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      style={styles.container}
    >
      {/* Companion Bar Header */}
      <View style={styles.topBar}>
        <AIAvatar size={46} />
        <View style={styles.topBarInfo}>
          <Text style={[styles.companionName, { fontSize: fs(17) }]}>Trợ lý Mimamori AI</Text>
          <View style={styles.onlineBadgeRow}>
            <View style={styles.greenPulse} />
            <Text style={[styles.onlineStatusText, { fontSize: fs(12) }]}>
              Luôn sẵn sàng lắng nghe cụ
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.voiceHeaderPill}
          onPress={handleVoicePress}
          activeOpacity={0.7}
        >
          <Feather name="mic" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.voiceHeaderText, { fontSize: fs(12) }]}>Giọng nói</Text>
        </TouchableOpacity>
      </View>

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
              <AIAvatar size={64} />
              <Text style={[styles.emptyWelcomeTitle, { fontSize: fs(19) }]}>Kính chào cụ!</Text>
              <Text style={[styles.emptyWelcomeSub, { fontSize: fs(14) }]}>
                Cháu là trợ lý Mimamori AI. Cụ có thể trò chuyện về sức khỏe, kể chuyện vui, hay hỏi bất kỳ điều gì với cháu nhé!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.sender === 'USER';
            const timeStr = formatMessageTime(item.createdAt);

            return (
              <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
                {!isUser && (
                  <View style={styles.aiMessageAvatar}>
                    <Feather name="smile" size={14} color={colors.primary} />
                  </View>
                )}

                <View style={styles.bubbleCol}>
                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                    <Text
                      style={[
                        styles.messageText,
                        { fontSize: fs(16) },
                        isUser ? styles.userText : styles.aiText,
                      ]}
                    >
                      {item.content}
                    </Text>
                  </View>
                  {timeStr ? (
                    <Text
                      style={[
                        styles.timestamp,
                        { fontSize: fs(11) },
                        isUser ? styles.timeRight : styles.timeLeft,
                      ]}
                    >
                      {timeStr}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Suggested Quick Question Chips */}
      <View style={styles.suggestionsContainer}>
        <View style={styles.suggestionsHeaderRow}>
          <Feather name="help-circle" size={13} color={colors.primary} style={{ marginRight: 5 }} />
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
              onPress={() => handleSendMessage(prompt)}
              disabled={sending}
              activeOpacity={0.7}
            >
              <Text style={[styles.suggestionChipText, { fontSize: fs(13) }]}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Input Area */}
      <View style={styles.inputArea}>
        <TouchableOpacity
          style={styles.voiceInputBtn}
          onPress={handleVoicePress}
          activeOpacity={0.7}
          accessibilityLabel="Thu âm giọng nói (Sắp ra mắt)"
        >
          <Feather name="mic" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, { fontSize: fs(15) }]}
          placeholder="Nhập điều cụ muốn tâm sự..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSendMessage()}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    ...shadows.subtle,
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
  greenPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  onlineStatusText: {
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  voiceHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  voiceHeaderText: {
    color: colors.primary,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyWelcome: {
    alignItems: 'center',
    paddingVertical: 40,
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
    marginBottom: 4,
  },
  bubbleCol: {
    maxWidth: '82%',
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
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
  timestamp: {
    color: colors.textMuted,
    marginTop: 4,
  },
  timeRight: {
    textAlign: 'right',
    marginRight: 4,
  },
  timeLeft: {
    textAlign: 'left',
    marginLeft: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surfaceWarm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 10,
  },
  voiceInputBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
});