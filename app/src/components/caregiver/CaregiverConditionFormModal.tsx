import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as lightColors, shadows } from '../../core/theme/colors';
import { useCaregiverTheme } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import {
  HealthConditionDto,
  HealthConditionSeverity,
  HealthConditionStatus,
  addDaysToIsoDate,
  formatDateKey,
  formatIsoDateToDisplay,
} from '../../core/utils/caregiverHelpers';

interface CaregiverConditionFormModalProps {
  visible: boolean;
  elderlyId: number;
  elderlyName?: string | null;
  editingCondition?: HealthConditionDto | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_CONDITIONS = [
  'Tăng huyết áp',
  'Tiểu đường',
  'Tim mạch',
  'Đau khớp',
  'Tiền đình / Mất ngủ',
];

const STATUS_OPTIONS: Array<{ key: HealthConditionStatus; label: string }> = [
  { key: 'MONITORING', label: 'Cần theo dõi' },
  { key: 'STABLE', label: 'Ổn định' },
  { key: 'WORSENING', label: 'Chuyển biến nặng' },
  { key: 'RECOVERED', label: 'Đã khỏi' },
];

const SEVERITY_OPTIONS: Array<{ key: HealthConditionSeverity; label: string }> = [
  { key: 'MILD', label: 'Nhẹ' },
  { key: 'MODERATE', label: 'Trung bình' },
  { key: 'SEVERE', label: 'Nặng' },
];

const parseDisplayDateToIso = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }
    return formatDateKey(candidate);
  }

  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return trimmed;
  }

  return null;
};

export const CaregiverConditionFormModal: React.FC<CaregiverConditionFormModalProps> = ({
  visible,
  elderlyId,
  elderlyName,
  editingCondition,
  onClose,
  onSaved,
}) => {
  const { isDark, c: colors, fs } = useCaregiverTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [conditionName, setConditionName] = useState('');
  const [status, setStatus] = useState<HealthConditionStatus>('MONITORING');
  const [severity, setSeverity] = useState<HealthConditionSeverity>('MODERATE');
  const [doctorOrClinic, setDoctorOrClinic] = useState('');
  const [recordDateDisplay, setRecordDateDisplay] = useState(() =>
    formatIsoDateToDisplay(formatDateKey(new Date()))
  );
  const [nextCheckupDisplay, setNextCheckupDisplay] = useState('');
  const [symptomsOrNotes, setSymptomsOrNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const todayIso = formatDateKey(new Date());
    if (editingCondition) {
      setConditionName(editingCondition.conditionName || '');
      setStatus((editingCondition.status as HealthConditionStatus) || 'MONITORING');
      setSeverity((editingCondition.severity as HealthConditionSeverity) || 'MODERATE');
      setDoctorOrClinic(editingCondition.doctorOrClinic || '');
      setRecordDateDisplay(formatIsoDateToDisplay(editingCondition.recordDate || todayIso));
      setNextCheckupDisplay(
        editingCondition.nextCheckupDate
          ? formatIsoDateToDisplay(editingCondition.nextCheckupDate)
          : ''
      );
      setSymptomsOrNotes(editingCondition.symptomsOrNotes || '');
    } else {
      setConditionName('');
      setStatus('MONITORING');
      setSeverity('MODERATE');
      setDoctorOrClinic('');
      setRecordDateDisplay(formatIsoDateToDisplay(todayIso));
      setNextCheckupDisplay('');
      setSymptomsOrNotes('');
    }
  }, [visible, editingCondition]);

  const setQuickNextCheckup = (days: number | null) => {
    if (days === null) {
      setNextCheckupDisplay('');
      return;
    }
    const baseIso = parseDisplayDateToIso(recordDateDisplay) || formatDateKey(new Date());
    setNextCheckupDisplay(formatIsoDateToDisplay(addDaysToIsoDate(baseIso, days)));
  };

  const handleSave = async () => {
    if (!conditionName.trim()) {
      Alert.alert('Thiếu tên bệnh lý', 'Vui lòng nhập tên bệnh lý hoặc vấn đề sức khỏe cần theo dõi.');
      return;
    }

    const recordDateIso = parseDisplayDateToIso(recordDateDisplay);
    if (!recordDateIso) {
      Alert.alert('Ngày khám không hợp lệ', 'Vui lòng nhập ngày khám theo định dạng DD/MM/YYYY.');
      return;
    }

    let nextCheckupIso: string | null = null;
    if (nextCheckupDisplay.trim()) {
      nextCheckupIso = parseDisplayDateToIso(nextCheckupDisplay);
      if (!nextCheckupIso) {
        Alert.alert('Ngày tái khám không hợp lệ', 'Vui lòng nhập ngày hẹn theo định dạng DD/MM/YYYY.');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        elderlyId,
        conditionName: conditionName.trim(),
        status,
        severity,
        recordDate: recordDateIso,
        nextCheckupDate: nextCheckupIso,
        doctorOrClinic: doctorOrClinic.trim() || null,
        symptomsOrNotes: symptomsOrNotes.trim() || null,
      };

      const url = editingCondition
        ? `/api/health-conditions/${editingCondition.id}`
        : '/api/health-conditions';
      const method = editingCondition ? 'PUT' : 'POST';

      const res = await apiClient(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        Alert.alert(
          editingCondition ? 'Đã cập nhật hồ sơ' : 'Đã ghi nhận bệnh lý',
          editingCondition
            ? `Đã cập nhật tình trạng "${conditionName.trim()}".`
            : `Đã lưu thông tin theo dõi "${conditionName.trim()}"${elderlyName ? ` cho ${elderlyName}` : ''}.`
        );
        onSaved();
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Không thể lưu', err?.message || 'Đã xảy ra lỗi khi lưu thông tin bệnh lý.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={() => !saving && onClose()}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.headerTitleCol}>
                <Text style={[styles.title, { fontSize: fs(17.5) }]}>
                  {editingCondition ? 'Cập nhật tái khám / bệnh lý' : 'Ghi nhận bệnh lý & Khám bệnh'}
                </Text>
                <Text style={[styles.subtitle, { fontSize: fs(12.5) }]}>
                  {elderlyName ? `Hồ sơ sức khỏe: ${elderlyName}` : 'Theo dõi diễn biến và lịch tái khám'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Đóng biểu mẫu bệnh lý"
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              <Text style={[styles.label, { fontSize: fs(13) }]}>Tên bệnh lý / Triệu chứng chính *</Text>
              <View style={styles.inputRow}>
                <Feather name="activity" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ví dụ: Tăng huyết áp, Tiểu đường type 2"
                  placeholderTextColor={colors.textMuted}
                  value={conditionName}
                  onChangeText={setConditionName}
                  editable={!saving}
                />
              </View>
              <View style={styles.chipWrap}>
                {PRESET_CONDITIONS.map((item) => {
                  const active = conditionName.trim() === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setConditionName(item)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Tình trạng hiện tại *</Text>
              <View style={styles.chipWrap}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = status === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatus(opt.key)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Mức độ</Text>
              <View style={styles.chipWrap}>
                {SEVERITY_OPTIONS.map((opt) => {
                  const active = severity === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSeverity(opt.key)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Diễn biến bệnh & Dặn dò bác sĩ</Text>
              <View style={styles.textAreaWrap}>
                <TextInput
                  style={[
                    styles.textAreaInput,
                    { fontSize: fs(14), lineHeight: Math.round(fs(14) * 1.42) },
                  ]}
                  placeholder="Ví dụ: Tái khám ngày hôm nay huyết áp 135/85 mmHg, bác sĩ kê thêm thuốc B buổi tối và dặn giảm mặn."
                  placeholderTextColor={colors.textMuted}
                  value={symptomsOrNotes}
                  onChangeText={setSymptomsOrNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!saving}
                />
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Bác sĩ / Bệnh viện (tùy chọn)</Text>
              <View style={styles.inputRow}>
                <Feather name="map-pin" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14) }]}
                  placeholder="Ví dụ: BS. Tuấn · Phòng khám Lão khoa"
                  placeholderTextColor={colors.textMuted}
                  value={doctorOrClinic}
                  onChangeText={setDoctorOrClinic}
                  editable={!saving}
                />
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Ngày khám / Ghi nhận (DD/MM/YYYY) *</Text>
              <View style={styles.dateRow}>
                <View style={[styles.inputRow, { flex: 1, minWidth: 0 }]}>
                  <Feather name="calendar" size={16} color={colors.primary} />
                  <TextInput
                    style={[styles.textInput, { fontSize: fs(14) }]}
                    placeholder="19/11/2026"
                    placeholderTextColor={colors.textMuted}
                    value={recordDateDisplay}
                    onChangeText={setRecordDateDisplay}
                    editable={!saving}
                  />
                </View>
                <TouchableOpacity
                  style={styles.quickTodayBtn}
                  onPress={() => setRecordDateDisplay(formatIsoDateToDisplay(formatDateKey(new Date())))}
                  disabled={saving}
                >
                  <Text style={[styles.quickTodayBtnText, { fontSize: fs(12.5) }]}>Hôm nay</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Lịch hẹn tái khám (DD/MM/YYYY - tùy chọn)</Text>
              <View style={styles.inputRow}>
                <Feather name="bell" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14) }]}
                  placeholder="Để trống nếu chưa có lịch hẹn"
                  placeholderTextColor={colors.textMuted}
                  value={nextCheckupDisplay}
                  onChangeText={setNextCheckupDisplay}
                  editable={!saving}
                />
              </View>
              <View style={styles.chipWrap}>
                {[
                  { label: 'Chưa hẹn', days: null },
                  { label: '+ 7 ngày', days: 7 },
                  { label: '+ 14 ngày', days: 14 },
                  { label: '+ 30 ngày', days: 30 },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.chip, opt.days === null && !nextCheckupDisplay && styles.chipActive]}
                    onPress={() => setQuickNextCheckup(opt.days)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { fontSize: fs(12) },
                        opt.days === null && !nextCheckupDisplay && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.cancelBtnText, { fontSize: fs(14) }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={[styles.saveBtnText, { fontSize: fs(14) }]}>
                    {editingCondition ? 'Lưu cập nhật' : 'Lưu hồ sơ bệnh lý'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: typeof lightColors, isDark: boolean) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(38, 51, 45, 0.45)',
    justifyContent: 'center',
  },
  backdropPress: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  formScrollContent: {
    paddingBottom: 10,
  },
  label: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 6,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  textAreaWrap: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  textAreaInput: {
    minHeight: 84,
    color: colors.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    flexShrink: 0,
  },
  quickTodayBtnText: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cancelBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'center',
  },
  saveBtn: {
    flex: 1.8,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontWeight: '800',
    color: colors.textInverse,
    flexShrink: 1,
    textAlign: 'center',
  },
});
