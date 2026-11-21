import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';
import type { SttEngine, VoiceRecognitionState } from '../core/voice/useVoiceRecognition';
import { VoiceWaveform } from './VoiceWaveform';

interface VoiceControlPanelProps {
  voiceState: VoiceRecognitionState;
  interimText: string;
  errorMessage: string | null;
  permissionDenied: boolean;
  audioLevel: number;
  sttEngine: SttEngine;
  inputText: string;
  onChangeInputText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  continuousMode: boolean;
  isSpeaking: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onCancelListening: () => void;
  onRetryListening: () => void;
  onDismissError: () => void;
  onEndContinuousMode: () => void;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  voiceState,
  interimText,
  errorMessage,
  permissionDenied,
  audioLevel,
  sttEngine,
  inputText,
  onChangeInputText,
  onSend,
  sending,
  continuousMode,
  isSpeaking,
  onStartListening,
  onStopListening,
  onCancelListening,
  onRetryListening,
  onDismissError,
  onEndContinuousMode,
}) => {
  const { fs } = useAccessibilityStore();

  const canSend = inputText.trim().length > 0 && !sending;
  const isRecognized = voiceState === 'recognized';

  const handleOpenDeviceSettings = () => {
    void Linking.openSettings().catch(() => {});
  };

  return (
    <View style={styles.wrapper}>
      {/* Active Continuous Voice Conversation Banner */}
      {continuousMode && (
        <View style={styles.continuousBanner}>
          <View style={styles.continuousStatusRow}>
            <View style={styles.continuousDot} />
            <Text style={[styles.continuousStatusText, { fontSize: fs(13) }]}>
              {isSpeaking
                ? 'Mimamori đang đọc câu trả lời...'
                : sending
                  ? 'Đang gửi và chờ Mimamori trả lời...'
                  : 'Chế độ trò chuyện bằng giọng nói đang bật'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.endContinuousBtn}
            onPress={onEndContinuousMode}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Kết thúc trò chuyện giọng nói"
          >
            <Feather name="phone-off" size={16} color="#FFFFFF" />
            <Text style={[styles.endContinuousBtnText, { fontSize: fs(14) }]}>
              Kết thúc trò chuyện giọng nói
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State 2: Listening */}
      {voiceState === 'listening' && (
        <View style={styles.listeningCard}>
          <View style={styles.listeningHeader}>
            <View style={styles.listeningMicBadge}>
              <Feather name="mic" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.listeningTitleCol}>
              <Text style={[styles.listeningTitle, { fontSize: fs(16) }]}>
                Mimamori đang lắng nghe...
              </Text>
              <View style={styles.waveformWrap}>
                <VoiceWaveform audioLevel={audioLevel} active color={colors.dangerText} height={24} />
              </View>
            </View>
          </View>

          <View style={styles.interimBox}>
            <Text style={[styles.interimText, { fontSize: fs(15) }]}>
              {interimText.trim()
                ? `“${interimText.trim()}”`
                : sttEngine === 'cloud-fallback'
                  ? 'Ông/bà hãy nói tự nhiên, rồi bấm “Dừng” khi nói xong nhé.'
                  : 'Ông/bà hãy nói tự nhiên nhé, cháu đang nghe...'}
            </Text>
          </View>

          <View style={styles.listeningActions}>
            <TouchableOpacity
              style={styles.cancelListenBtn}
              onPress={onCancelListening}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Hủy thu âm"
            >
              <Feather name="x" size={18} color={colors.textPrimary} />
              <Text style={[styles.cancelListenText, { fontSize: fs(15) }]}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stopListenBtn}
              onPress={onStopListening}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Dừng thu âm và nhận diện"
            >
              <Feather name="square" size={16} color="#FFFFFF" />
              <Text style={[styles.stopListenText, { fontSize: fs(15) }]}>Dừng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* State 3: Recognizing */}
      {voiceState === 'recognizing' && (
        <View style={styles.recognizingCard}>
          <View style={styles.recognizingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.recognizingText, { fontSize: fs(15) }]}>
              Đang nhận diện giọng nói...
            </Text>
          </View>
          <TouchableOpacity
            style={styles.recognizingCancelBtn}
            onPress={onCancelListening}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Hủy nhận diện giọng nói"
          >
            <Text style={[styles.recognizingCancelText, { fontSize: fs(13) }]}>Hủy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State 4: Recognized (turn-by-turn review/edit banner) */}
      {isRecognized && !continuousMode && (
        <View style={styles.recognizedBanner}>
          <View style={styles.recognizedInfo}>
            <Feather name="check-circle" size={16} color={colors.successText} />
            <Text style={[styles.recognizedHint, { fontSize: fs(13) }]}>
              Cháu đã ghi lại lời nói. Ông/bà có thể sửa lại hoặc bấm Gửi:
            </Text>
          </View>
          <TouchableOpacity
            style={styles.retryPillBtn}
            onPress={onRetryListening}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Nói lại"
          >
            <Feather name="mic" size={14} color={colors.primary} />
            <Text style={[styles.retryPillText, { fontSize: fs(13) }]}>Nói lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State 5: Error / Failed STT */}
      {voiceState === 'error' && (
        <View style={styles.errorBanner}>
          <View style={styles.errorHeaderRow}>
            <Feather name="alert-circle" size={18} color={colors.dangerText} />
            <Text style={[styles.errorMessageText, { fontSize: fs(14) }]}>
              {errorMessage || 'Cháu chưa nghe rõ, ông/bà nói lại giúp cháu nhé.'}
            </Text>
          </View>
          {permissionDenied && (
            <Text style={[styles.permissionFallbackHint, { fontSize: fs(12.5) }]}>
              Ông/bà vẫn có thể gõ chữ vào ô bên dưới để trò chuyện với cháu nhé.
            </Text>
          )}
          <View style={styles.errorActionsRow}>
            <TouchableOpacity
              style={styles.errorRetryBtn}
              onPress={onRetryListening}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Nói lại"
            >
              <Feather name="mic" size={14} color="#FFFFFF" />
              <Text style={[styles.errorRetryText, { fontSize: fs(13.5) }]}>Nói lại</Text>
            </TouchableOpacity>

            {permissionDenied && Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.errorSettingsBtn}
                onPress={handleOpenDeviceSettings}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Mở cài đặt quyền"
              >
                <Feather name="settings" size={14} color={colors.textPrimary} />
                <Text style={[styles.errorSettingsText, { fontSize: fs(13.5) }]}>Cài đặt</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.errorDismissBtn}
              onPress={onDismissError}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo lỗi"
            >
              <Text style={[styles.errorDismissText, { fontSize: fs(13.5) }]}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* State 1 (Idle) & Coexisting Keyboard Input Row (shown unless actively listening/recognizing) */}
      {voiceState !== 'listening' && voiceState !== 'recognizing' && (
        <View style={styles.idleSection}>
          {!isRecognized && !continuousMode && (
            <TouchableOpacity
              style={styles.micHintRow}
              onPress={onStartListening}
              activeOpacity={0.7}
              disabled={sending}
            >
              <Feather name="mic" size={13} color={colors.primary} />
              <Text style={[styles.micHintLabel, { fontSize: fs(13) }]}>
                Nhấn để nói chuyện
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.largeMicBtn,
                continuousMode && styles.largeMicBtnActive,
                sending && styles.largeMicBtnDisabled,
              ]}
              onPress={onStartListening}
              disabled={sending}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Nhấn để nói chuyện với trợ lý Mimamori"
            >
              <Feather
                name="mic"
                size={26}
                color={continuousMode ? '#FFFFFF' : colors.primary}
              />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.textInput,
                isRecognized && styles.textInputHighlighted,
                { fontSize: fs(15) },
              ]}
              placeholder="Nhập điều cụ muốn tâm sự..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={onChangeInputText}
              multiline
              editable={!sending}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                isRecognized && canSend && styles.sendBtnHighlighted,
                !canSend && styles.sendBtnDisabled,
              ]}
              onPress={onSend}
              disabled={!canSend}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#FFFFFF" />
                  <Text style={[styles.sendBtnText, { fontSize: fs(14) }]}>Gửi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  continuousBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: 10,
    gap: 8,
  },
  continuousStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continuousDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  continuousStatusText: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  endContinuousBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerText,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  endContinuousBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listeningCard: {
    backgroundColor: colors.danger,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    padding: 14,
    gap: 12,
  },
  listeningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listeningMicBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  listeningTitleCol: {
    flex: 1,
    gap: 6,
  },
  listeningTitle: {
    color: colors.dangerText,
    fontWeight: '800',
  },
  waveformWrap: {
    alignItems: 'flex-start',
  },
  interimBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  interimText: {
    color: colors.textPrimary,
    fontWeight: '500',
    lineHeight: 22,
  },
  listeningActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelListenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelListenText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stopListenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.dangerText,
  },
  stopListenText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  recognizingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  recognizingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recognizingText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  recognizingCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recognizingCancelText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  recognizedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  recognizedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recognizedHint: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  retryPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 36,
  },
  retryPillText: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: 12,
    gap: 8,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorMessageText: {
    flex: 1,
    color: colors.dangerText,
    fontWeight: '700',
    lineHeight: 20,
  },
  permissionFallbackHint: {
    color: colors.textPrimary,
    fontWeight: '500',
    lineHeight: 18,
  },
  errorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  errorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.dangerText,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
  },
  errorSettingsText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  errorDismissBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  errorDismissText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  idleSection: {
    gap: 6,
  },
  micHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
  },
  micHintLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  largeMicBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  largeMicBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  largeMicBtnDisabled: {
    opacity: 0.55,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    maxHeight: 104,
    color: colors.textPrimary,
  },
  textInputHighlighted: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 66,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: colors.primary,
    marginBottom: 4,
  },
  sendBtnHighlighted: {
    backgroundColor: colors.primaryDark,
    ...shadows.card,
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
