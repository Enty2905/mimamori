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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as lightColors, shadows } from '../../core/theme/colors';
import { useCaregiverTheme } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import {
  MedicationDto,
  addDaysToIsoDate,
  formatDateKey,
  formatIsoDateToDisplay,
  formatTimeHHMM,
} from '../../core/utils/caregiverHelpers';

interface CaregiverMedicationFormModalProps {
  visible: boolean;
  elderlyId: number;
  elderlyName?: string | null;
  editingMedication?: MedicationDto | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_DOSAGES = ['1/2 viên', '1 viên', '2 viên', '1 gói'];
const PRESET_TIMES = ['06:00', '07:00', '08:00', '11:30', '12:00', '16:00', '18:00', '20:00', '21:00'];
const PRESET_INSTRUCTIONS = [
  'Sau ăn 15 phút',
  'Trước ăn 30 phút',
  'Trong bữa ăn',
  'Trước khi ngủ',
];
const DURATION_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: 'Dùng lâu dài', days: null },
  { label: '5 ngày', days: 5 },
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
];

const parseValidHHMM = (raw: string): string | null => {
  const match = raw.trim().match(/^(\d{1,2})[:hH](\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const CaregiverMedicationFormModal: React.FC<CaregiverMedicationFormModalProps> = ({
  visible,
  elderlyId,
  elderlyName,
  editingMedication,
  onClose,
  onSaved,
}) => {
  const { isDark, c: colors, fs } = useCaregiverTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1 viên');
  const [instructions, setInstructions] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['07:00']);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [startDate, setStartDate] = useState(() => formatDateKey(new Date()));
  const [endDate, setEndDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingMedication) {
      setName(editingMedication.name || '');
      setDosage(editingMedication.dosage || '1 viên');
      setInstructions(editingMedication.instructions || '');
      const parsedTimes = (editingMedication.schedules || [])
        .map((s) => formatTimeHHMM(s.reminderTime))
        .filter((t) => t !== '--:--');
      const uniqueSorted = Array.from(new Set(parsedTimes)).sort();
      setSelectedTimes(uniqueSorted.length > 0 ? uniqueSorted : ['07:00']);
      setStartDate(editingMedication.startDate || formatDateKey(new Date()));
      setEndDate(editingMedication.endDate || null);
    } else {
      setName('');
      setDosage('1 viên');
      setInstructions('Sau ăn 15 phút');
      setSelectedTimes(['07:00']);
      setStartDate(formatDateKey(new Date()));
      setEndDate(null);
    }
    setCustomTimeInput('');
  }, [visible, editingMedication]);

  const toggleTime = (time: string) => {
    setSelectedTimes((prev) => {
      if (prev.includes(time)) {
        return prev.filter((item) => item !== time);
      }
      return [...prev, time].sort();
    });
  };

  const handleAddCustomTime = () => {
    const normalized = parseValidHHMM(customTimeInput);
    if (!normalized) {
      Alert.alert('Giờ không hợp lệ', 'Vui lòng nhập đúng định dạng HH:mm (ví dụ: 09:30 hoặc 21:15).');
      return;
    }
    setSelectedTimes((prev) => Array.from(new Set([...prev, normalized])).sort());
    setCustomTimeInput('');
  };

  const handleSelectDuration = (days: number | null) => {
    if (days === null) {
      setEndDate(null);
    } else {
      setEndDate(addDaysToIsoDate(startDate, days - 1));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu tên thuốc', 'Vui lòng nhập tên thuốc được bác sĩ kê đơn.');
      return;
    }
    if (!dosage.trim()) {
      Alert.alert('Thiếu liều dùng', 'Vui lòng nhập liều dùng mỗi cữ (ví dụ: 1 viên).');
      return;
    }
    if (selectedTimes.length === 0) {
      Alert.alert('Chưa chọn giờ uống', 'Vui lòng chọn ít nhất một khung giờ uống thuốc trong ngày.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        elderlyId,
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim() || null,
        startDate,
        endDate,
        reminderTimes: selectedTimes.map((t) => `${t}:00`),
      };

      const url = editingMedication
        ? `/api/medications/${editingMedication.id}`
        : '/api/medications';
      const method = editingMedication ? 'PUT' : 'POST';

      const res = await apiClient(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        Alert.alert(
          editingMedication ? 'Đã cập nhật đơn thuốc' : 'Đã thêm thuốc mới',
          editingMedication
            ? `Đã lưu thay đổi cho thuốc "${name.trim()}".`
            : `Đã thêm "${name.trim()}" vào lịch nhắc uống thuốc${elderlyName ? ` của ${elderlyName}` : ''}.`
        );
        onSaved();
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Không thể lưu thuốc', err?.message || 'Đã xảy ra lỗi khi lưu đơn thuốc.');
    } finally {
      setSaving(false);
    }
  };

  const extraSelectedTimes = selectedTimes.filter((t) => !PRESET_TIMES.includes(t));

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
                  {editingMedication ? 'Chỉnh sửa đơn thuốc' : 'Thêm thuốc mới'}
                </Text>
                <Text style={[styles.subtitle, { fontSize: fs(12.5) }]}>
                  {elderlyName ? `Áp dụng cho: ${elderlyName}` : 'Thiết lập lịch nhắc uống thuốc'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Đóng biểu mẫu thuốc"
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              <Text style={[styles.label, { fontSize: fs(13) }]}>Tên thuốc *</Text>
              <View style={styles.inputRow}>
                <MaterialCommunityIcons name="pill" size={17} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ví dụ: Amlodipine 5mg (Huyết áp)"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  editable={!saving}
                />
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Liều dùng mỗi lần *</Text>
              <View style={styles.inputRow}>
                <Feather name="layers" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ví dụ: 1 viên"
                  placeholderTextColor={colors.textMuted}
                  value={dosage}
                  onChangeText={setDosage}
                  editable={!saving}
                />
              </View>
              <View style={styles.chipWrap}>
                {PRESET_DOSAGES.map((item) => {
                  const active = dosage.trim() === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setDosage(item)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>
                Khung giờ uống trong ngày * ({selectedTimes.length} cữ)
              </Text>
              <View style={styles.chipWrap}>
                {[...PRESET_TIMES, ...extraSelectedTimes].map((time) => {
                  const active = selectedTimes.includes(time);
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleTime(time)}
                      disabled={saving}
                    >
                      <Feather
                        name="clock"
                        size={12}
                        color={active ? colors.textInverse : colors.primary}
                      />
                      <Text style={[styles.chipText, { fontSize: fs(12.5) }, active && styles.chipTextActive]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.customTimeRow}>
                <View style={[styles.inputRow, styles.customTimeInputWrap]}>
                  <Feather name="plus-circle" size={15} color={colors.primary} />
                  <TextInput
                    style={[styles.textInput, { fontSize: fs(13.5) }]}
                    placeholder="Giờ khác (14:30)"
                    placeholderTextColor={colors.textMuted}
                    value={customTimeInput}
                    onChangeText={setCustomTimeInput}
                    keyboardType="numbers-and-punctuation"
                    editable={!saving}
                  />
                </View>
                <TouchableOpacity
                  style={styles.addCustomTimeBtn}
                  onPress={handleAddCustomTime}
                  disabled={saving}
                >
                  <Text style={[styles.addCustomTimeBtnText, { fontSize: fs(13) }]}>Thêm giờ</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Hướng dẫn / Ghi chú bác sĩ</Text>
              <View style={styles.inputRow}>
                <Feather name="file-text" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14) }]}
                  placeholder="Ví dụ: Uống sau ăn sáng 15 phút"
                  placeholderTextColor={colors.textMuted}
                  value={instructions}
                  onChangeText={setInstructions}
                  editable={!saving}
                />
              </View>
              <View style={styles.chipWrap}>
                {PRESET_INSTRUCTIONS.map((item) => {
                  const active = instructions.trim() === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setInstructions(item)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { fontSize: fs(13) }]}>Thời hạn dùng thuốc</Text>
              <View style={styles.chipWrap}>
                {DURATION_OPTIONS.map((opt) => {
                  const expectedEnd = opt.days === null ? null : addDaysToIsoDate(startDate, opt.days - 1);
                  const active = endDate === expectedEnd;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => handleSelectDuration(opt.days)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, { fontSize: fs(12) }, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.dateSummaryText, { fontSize: fs(12) }]}>
                Bắt đầu: {formatIsoDateToDisplay(startDate)}
                {endDate ? ` · Kết thúc: ${formatIsoDateToDisplay(endDate)}` : ' · Duy trì hằng ngày'}
              </Text>
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
                    {editingMedication ? 'Lưu thay đổi' : 'Thêm vào đơn thuốc'}
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  customTimeInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  addCustomTimeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    flexShrink: 0,
  },
  addCustomTimeBtnText: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  dateSummaryText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontWeight: '600',
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
