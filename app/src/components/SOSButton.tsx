import {useOriginalLabels} from '../core/localization/original';
import {useColors} from '../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from './CareText';
import React, { useState, useRef } from 'react';
import {
  View,
    StyleSheet,
    Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../core/theme/colors';
import { careApi } from '../core/api/careApi';
import * as Crypto from 'expo-crypto';
import {useTranslation} from 'react-i18next';
import {Notice} from './CareUI';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  emergencyContactName?: string;
}

export const SOSButton: React.FC<Props> = () => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const {t} = useTranslation();
  const requestId = useRef<string | null>(null);
  const flight = useRef(false);
  const [failed,setFailed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const { fs,fontScale } = useAccessibilityStore();

  const handleConfirmSOS = async () => {
    if(flight.current) return;
    flight.current=true;setSending(true);setFailed(false);
    requestId.current ??= Crypto.randomUUID();
    try {
      const result=await careApi.emergency(requestId.current);
      setModalVisible(false);
      Alert.alert(t('sosConfirm'),t('sosRecorded',{count:result.recipientCount}));
      requestId.current=null;
    } catch { setFailed(true); }
    finally {flight.current=false;setSending(false);}
  };

  return (
    <>
      <TouchableOpacity
        style={styles.sosPill}
        onPress={() => {setFailed(false);requestId.current=null;setModalVisible(true);}}
        activeOpacity={0.85}
        accessibilityLabel={t('sos')}
        accessibilityRole="button"
      >
        <View style={styles.sosIconContainer}>
          <Feather name="alert-triangle" size={18} color={colors.textInverse} />
        </View>
        <View style={styles.sosTextCol}>
          <Text style={[styles.sosTitle, { fontSize: fs(15) }]}>{t('sos')}</Text>
          {fontScale <= 1.2 && <Text style={[styles.sosSubtitle, { fontSize: fs(12) }]}>{t('sosHelp')}</Text>}
        </View>
      </TouchableOpacity>

      {/* Confirmation Modal */}
      <Modal visible={modalVisible} onRequestClose={() => {if(!sending)setModalVisible(false);}} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Feather name="alert-triangle" size={32} color={colors.dangerText} />
            </View>

            <Text style={[styles.modalTitle, { fontSize: fs(20) }]}>{t('sosConfirm')}</Text>
            <Text style={[styles.modalDesc, { fontSize: fs(14) }]}>
              {t("sosExplanation")}
            </Text>
            <Text style={[styles.modalSubDesc, { fontSize: fs(13) }]}>{tr("Cụ có chắc chắn muốn phát tín hiệu khẩn cấp không?")}</Text>

            {failed && <Notice tone="danger" text={t("sosFailed")} />}
            <View style={styles.modalButtonStack}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSOS}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={[styles.confirmButtonText, { fontSize: fs(15) }]}>
                    {t(failed ? 'sosRetry' : 'sosSend')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={sending}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { fontSize: fs(14) }]}>{tr("Hủy bỏ, tôi bấm nhầm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
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
    minHeight: 56,
    borderRadius: 19,
    backgroundColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sosBadgeText: {
    color: colors.textInverse,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  sosTextCol: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
