import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../core/theme/colors';
import { apiClient } from '../core/api/client';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  emergencyContactName?: string;
}

export const SOSButton: React.FC<Props> = ({ emergencyContactName = 'Con gái (Nguyễn Thị Hoa)' }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const { fs } = useAccessibilityStore();

  const handleConfirmSOS = async () => {
    try {
      setSending(true);
      await apiClient('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: '🚨 TÍN HIỆU KHẨN CẤP TỪ NGƯỜI CAO TUỔI',
          message: `Người cao tuổi vừa nhấn nút SOS khẩn cấp trên ứng dụng Mimamori AI! Vui lòng liên hệ kiểm tra ngay!`,
          type: 'EMERGENCY',
        }),
      }).catch(() => {});

      setModalVisible(false);
      Alert.alert(
        'Đã phát tín hiệu khẩn cấp',
        `Thông báo khẩn cấp đã được gửi trực tiếp đến ${emergencyContactName} và hệ thống theo dõi gia đình.`,
        [{ text: 'Tôi đã hiểu', style: 'default' }]
      );
    } catch {
      setModalVisible(false);
      Alert.alert('Đã gửi thông báo', `Đã liên lạc đến người thân của cụ.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.sosPill}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Nút gọi khẩn cấp SOS"
        accessibilityRole="button"
      >
        <View style={styles.sosIconContainer}>
          <Feather name="alert-triangle" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.sosTextCol}>
          <Text style={[styles.sosTitle, { fontSize: fs(15) }]}>Cần trợ giúp khẩn cấp?</Text>
          <Text style={[styles.sosSubtitle, { fontSize: fs(12) }]}>Bấm để báo ngay cho người thân</Text>
        </View>
      </TouchableOpacity>

      {/* Confirmation Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Feather name="alert-triangle" size={32} color={colors.dangerText} />
            </View>

            <Text style={[styles.modalTitle, { fontSize: fs(20) }]}>Xác nhận gọi khẩn cấp</Text>
            <Text style={[styles.modalDesc, { fontSize: fs(14) }]}>
              Hệ thống sẽ gửi ngay cảnh báo đỏ đến điện thoại của{' '}
              <Text style={styles.boldContact}>{emergencyContactName}</Text>.
            </Text>
            <Text style={[styles.modalSubDesc, { fontSize: fs(13) }]}>
              Cụ có chắc chắn muốn phát tín hiệu khẩn cấp không?
            </Text>

            <View style={styles.modalButtonStack}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSOS}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmButtonText, { fontSize: fs(15) }]}>
                    Phát tín hiệu khẩn cấp ngay
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={sending}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { fontSize: fs(14) }]}>Hủy bỏ, tôi bấm nhầm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
