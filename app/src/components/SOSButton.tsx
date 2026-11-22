import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../core/theme/colors';
import { apiClient } from '../core/api/client';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  emergencyContactName?: string;
  emergencyContactPhone?: string | null;
  onEmergencyPhoneUpdated?: (newPhone: string | null) => void;
}

function sanitizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/[^\d+]/g, '').trim();
}

export const SOSButton: React.FC<Props> = ({
  emergencyContactName = 'Người giám sát',
  emergencyContactPhone,
  onEmergencyPhoneUpdated,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(emergencyContactPhone || '');
  const { fs } = useAccessibilityStore();
  const { updateUser } = useAuthStore();

  useEffect(() => {
    setPhoneInput(emergencyContactPhone || '');
    if (!sanitizePhoneNumber(emergencyContactPhone)) {
      setEditingPhone(true);
    } else {
      setEditingPhone(false);
    }
  }, [emergencyContactPhone]);

  const savedPhone = emergencyContactPhone?.trim() || '';
  const draftPhone = phoneInput.trim();
  const activeDisplayPhone = savedPhone || draftPhone;
  const dialPhone = sanitizePhoneNumber(activeDisplayPhone);

  const openPhoneDialer = async (phoneToCall: string) => {
    const telUrl = `tel:${phoneToCall}`;
    try {
      await Linking.openURL(telUrl);
      return true;
    } catch {
      return false;
    }
  };

  const persistEmergencyPhone = async (rawPhone: string): Promise<string | null> => {
    const cleaned = rawPhone.trim();
    const digitsOnly = sanitizePhoneNumber(cleaned);
    if (cleaned && digitsOnly.length < 8) {
      Alert.alert('Số điện thoại chưa hợp lệ', 'Vui lòng nhập số điện thoại có ít nhất 8 chữ số.');
      return null;
    }
    const nextValue = cleaned ? digitsOnly : null;
    setSavingPhone(true);
    try {
      const res = await apiClient<any>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ emergencyContact: nextValue }),
      });
      if (res.success) {
        updateUser({ emergencyContact: nextValue ?? undefined });
        onEmergencyPhoneUpdated?.(nextValue);
        setEditingPhone(false);
        return nextValue;
      }
      Alert.alert('Không thể lưu SĐT', res.message || 'Vui lòng thử lại.');
      return null;
    } catch (err: any) {
      Alert.alert('Không thể lưu SĐT', err?.message || 'Vui lòng thử lại.');
      return null;
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSavePhoneOnly = async () => {
    const saved = await persistEmergencyPhone(phoneInput);
    if (saved) {
      Alert.alert('Đã lưu SĐT người giám sát', `Số ${saved} đã được gắn vào nút gọi khẩn cấp.`);
    }
  };

  const handleConfirmSOS = async () => {
    let targetDialPhone = sanitizePhoneNumber(savedPhone);
    let targetDisplayPhone = savedPhone;

    if (!targetDialPhone && draftPhone) {
      if (sanitizePhoneNumber(draftPhone).length < 8) {
        Alert.alert('Số điện thoại chưa hợp lệ', 'Vui lòng nhập SĐT người giám sát hợp lệ hoặc để trống nếu chỉ muốn gửi cảnh báo trong app.');
        return;
      }
      const saved = await persistEmergencyPhone(draftPhone);
      if (saved) {
        targetDialPhone = saved;
        targetDisplayPhone = saved;
      }
    }

    try {
      setSending(true);
      await apiClient('/api/alerts/sos', {
        method: 'POST',
        body: JSON.stringify({
          message: `TÍN HIỆU KHẨN CẤP (SOS): Người cao tuổi vừa nhấn nút cần trợ giúp khẩn cấp! Vui lòng liên hệ kiểm tra ngay.`,
        }),
      }).catch(() => {});

      setModalVisible(false);

      if (targetDialPhone) {
        const opened = await openPhoneDialer(targetDialPhone);
        if (!opened) {
          Alert.alert(
            'Đã phát tín hiệu khẩn cấp',
            `Thông báo đã gửi tới ${emergencyContactName}. Thiết bị này chưa hỗ trợ mở cuộc gọi trực tiếp tới ${targetDisplayPhone}.`,
            [{ text: 'Tôi đã hiểu', style: 'default' }]
          );
        }
        return;
      }

      Alert.alert(
        'Đã phát tín hiệu khẩn cấp',
        `Cảnh báo khẩn cấp đã được gửi trực tiếp đến tài khoản của ${emergencyContactName} trên hệ thống.`,
        [{ text: 'Tôi đã hiểu', style: 'default' }]
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.sosPill}
        onPress={() => {
          setPhoneInput(emergencyContactPhone || '');
          setEditingPhone(!sanitizePhoneNumber(emergencyContactPhone));
          setModalVisible(true);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Nút gọi và phát tín hiệu khẩn cấp SOS"
        accessibilityRole="button"
      >
        <View style={styles.sosIconContainer}>
          <Feather name={sanitizePhoneNumber(savedPhone) ? 'phone-call' : 'alert-triangle'} size={18} color="#FFFFFF" />
        </View>
        <View style={styles.sosTextCol}>
          <Text style={[styles.sosTitle, { fontSize: fs(15) }]}>Cần trợ giúp khẩn cấp?</Text>
          <Text style={[styles.sosSubtitle, { fontSize: fs(12) }]} numberOfLines={1}>
            {sanitizePhoneNumber(savedPhone)
              ? `Bấm để báo & gọi ngay: ${emergencyContactName} (${savedPhone})`
              : `Bấm để gắn SĐT gọi hoặc báo ngay ${emergencyContactName}`}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Confirmation & Caregiver Phone Quick Setup Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Feather name={dialPhone ? 'phone-call' : 'alert-triangle'} size={32} color={colors.dangerText} />
            </View>

            <Text style={[styles.modalTitle, { fontSize: fs(20) }]}>Phát tín hiệu & Gọi khẩn cấp</Text>
            <Text style={[styles.modalDesc, { fontSize: fs(14) }]}>
              {dialPhone ? (
                <>
                  Hệ thống sẽ gửi cảnh báo tới{' '}
                  <Text style={styles.boldContact}>{emergencyContactName}</Text> và gọi trực tiếp số{' '}
                  <Text style={styles.boldContact}>{activeDisplayPhone}</Text>.
                </>
              ) : (
                <>
                  Hệ thống sẽ gửi cảnh báo đỏ tới{' '}
                  <Text style={styles.boldContact}>{emergencyContactName}</Text>. Gắn thêm SĐT bên dưới nếu muốn bấm là gọi thẳng.
                </>
              )}
            </Text>

            <View style={styles.phoneSetupBox}>
              <View style={styles.phoneSetupHeader}>
                <Text style={[styles.phoneSetupLabel, { fontSize: fs(12.5) }]}>
                  SĐT người giám sát
                </Text>
                {Boolean(savedPhone) && !editingPhone && (
                  <TouchableOpacity
                    onPress={() => setEditingPhone(true)}
                    disabled={sending || savingPhone}
                  >
                    <Text style={[styles.editPhoneLink, { fontSize: fs(12.5) }]}>Đổi SĐT</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editingPhone ? (
                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={[styles.phoneInput, { fontSize: fs(14) }]}
                    placeholder="Nhập SĐT người thân (VD: 0987...)"
                    placeholderTextColor={colors.textMuted}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    keyboardType="phone-pad"
                    editable={!sending && !savingPhone}
                  />
                  <TouchableOpacity
                    style={[styles.savePhoneBtn, (sending || savingPhone) && { opacity: 0.6 }]}
                    onPress={handleSavePhoneOnly}
                    disabled={sending || savingPhone}
                    activeOpacity={0.8}
                  >
                    {savingPhone ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.savePhoneBtnText, { fontSize: fs(13) }]}>Lưu</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.savedPhoneValue, { fontSize: fs(15) }]}>
                  {savedPhone}
                </Text>
              )}
            </View>

            <View style={styles.modalButtonStack}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSOS}
                disabled={sending || savingPhone}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmButtonText, { fontSize: fs(15) }]}>
                    {dialPhone ? `Phát tín hiệu & Gọi ${activeDisplayPhone}` : 'Chỉ phát tín hiệu trong app'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={sending || savingPhone}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { fontSize: fs(14) }]}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    minHeight: 54,
  },
  sosIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sosBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  sosTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sosTitle: {
    fontWeight: '800',
    color: colors.dangerText,
  },
  sosSubtitle: {
    color: colors.dangerText,
    opacity: 0.85,
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    ...shadows.elevated,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconLarge: {
    fontSize: 32,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.dangerText,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  boldContact: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubDesc: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalButtonStack: {
    width: '100%',
    gap: 10,
  },
  phoneSetupBox: {
    width: '100%',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  phoneSetupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneSetupLabel: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  editPhoneLink: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  savePhoneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePhoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  savedPhoneValue: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  confirmButton: {
    backgroundColor: colors.dangerText,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
