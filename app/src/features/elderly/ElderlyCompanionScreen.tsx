import {useOriginalLabels} from '../../core/localization/original';
import {useColors} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
    StyleSheet,
  TextInput,
    FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import {useCompanion} from './useCompanion';
import {Notice,Button} from '../../components/CareUI';
import * as Speech from 'expo-speech';
import {useTranslation} from 'react-i18next';
import { AIAvatar } from '../../components/AIAvatar';

const QUICK_PROMPTS = [
  'Hôm nay thời tiết thế nào cháu?',
  'Nhắc tôi nhớ uống nước ấm nhé',
  'Tôi cảm thấy hơi mỏi lưng hôm nay',
  'Kể cho tôi nghe một mẩu chuyện vui',
  'Tôi nên ăn gì để ngủ ngon hơn?',
];

export const ElderlyCompanionScreen: React.FC = () => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { fs } = useAccessibilityStore();
  const chat=useCompanion();
  const {t,i18n}=useTranslation();
  const {messages,loading,sending}=chat;
  const [inputText,setInputText]=useState('');
  const [speaking,setSpeaking]=useState(false);
  const flatListRef=useRef<FlatList>(null);
  useEffect(()=>()=>{void Speech.stop();},[]);
  const handleSendMessage=async (value?:string)=>{
    const text=(value??inputText).trim();
    if(!text || sending) return;
    setInputText('');
    if(!await chat.send(text)) setInputText(text);
  };
  const handleVoicePress=async ()=>{
    if(speaking){await Speech.stop();setSpeaking(false);return;}
    const reply=[...messages].reverse().find(item=>item.sender==='AI'||item.sender==='ASSISTANT');
    if(!reply)return;
    setSpeaking(true);
    Speech.speak(reply.content,{language:i18n.language==='ja'?'ja-JP':'vi-VN',onDone:()=>setSpeaking(false),onStopped:()=>setSpeaking(false),onError:()=>setSpeaking(false)});
  };
  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(i18n.language==='ja'?'ja-JP':'vi-VN', { hour: '2-digit', minute: '2-digit' });
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
          <Text style={[styles.companionName, { fontSize: fs(20) }]}>{tr("Trợ lý Mimamori AI")}</Text>
          <View style={styles.onlineBadgeRow}>
            <View style={styles.greenPulse} />
            <Text style={[styles.onlineStatusText, { fontSize: fs(12) }]}>{tr("Trò chuyện cùng Mimamori")}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.voiceHeaderPill}
          onPress={handleVoicePress}
          activeOpacity={0.7}
        >
          <Feather name="volume-2" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.voiceHeaderText, { fontSize: fs(12) }]}>{t(speaking?'stopSpeaking':'readAloud')}</Text>
        </TouchableOpacity>
      </View>

      {chat.error && <><Notice tone="danger" text={t('error')} /><Button title={t('retry')} onPress={chat.reload} /></>}
      {sending && <Button variant="secondary" title={t('cancel')} onPress={chat.cancel} />}
      {/* Messages Feed */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>{tr("Đang chuẩn bị cuộc trò chuyện...")}</Text>
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
              <Text style={[styles.emptyWelcomeTitle, { fontSize: fs(20) }]}>{tr("Kính chào cụ!")}</Text>
              <Text style={[styles.emptyWelcomeSub, { fontSize: fs(14) }]}>{tr("Cháu là trợ lý Mimamori AI. Cụ có thể trò chuyện về sức khỏe, kể chuyện vui, hay hỏi bất kỳ điều gì với cháu nhé!")}</Text>
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
                        { fontSize: fs(20) },
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
          <Text style={[styles.suggestionsHeader, { fontSize: fs(12) }]}>{tr("Gợi ý trò chuyện cùng trợ lý:")}</Text>
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
              disabled={sending || !chat.conversation}
              activeOpacity={0.7}
            >
              <Text style={[styles.suggestionChipText, { fontSize: fs(13) }]}>{tr(prompt)}</Text>
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
          accessibilityLabel={t(speaking?"stopSpeaking":"readAloud")}
          disabled={loading || messages.length===0}
        >
          <Feather name="volume-2" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, { fontSize: fs(20) }]}
          placeholder={tr("Nhập điều cụ muốn tâm sự...")}
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
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Feather name="send" size={16} color={colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
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
    marginLeft: 12,
  },
  companionName: {
    fontWeight: '800',
    color: colors.textPrimary,
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

  },
  userText: {
    color: colors.textInverse,
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
    minHeight: 56,
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
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
});
