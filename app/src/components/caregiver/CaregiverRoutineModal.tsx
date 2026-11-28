import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as lightColors, shadows } from '../../core/theme/colors';
import { useCaregiverTheme } from '../../core/theme/useTheme';
import { apiClient } from '../../core/api/client';
import { formatTimeHHMM } from '../../core/utils/caregiverHelpers';

export interface CareRoutineLogDto {
  id: number;
  routineType: 'WATER' | 'SLEEP';
  scheduledTime: string;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  completedAt?: string | null;
  note?: string | null;
}

export interface DailyRoutineOverviewDto {
  elderlyId: number;
  waterTargetCups: number;
  waterCompletedCups: number;
  waterTargetMl?: number;
  waterCupMl?: number;
  waterCompletedMl?: number;
  hydrationPercent?: number;
  hydrationStatus?: string;
  hydrationEvaluationText?: string;
  waterReminderTimes: string[];
  waterEnabled: boolean;
  bedtimeTime: string;
  wakeupTime: string;
  sleepTargetHours: number;
  sleepEnabled: boolean;
  sleepStatus: 'PENDING' | 'COMPLETED';
  sleepCompletedAt?: string | null;
  lastNightSleepQuality?: string | null;
  logs: CareRoutineLogDto[];
}

export interface CaregiverRoutineConfigPayload {
  waterTargetCups: number;
  waterTargetMl: number;
  waterCupMl: number;
  waterReminderTimes: string[];
  bedtimeTime: string;
  wakeupTime: string;
  sleepTargetHours: number;
  waterEnabled: boolean;
  sleepEnabled: boolean;
}

interface CaregiverRoutineModalProps {
  visible: boolean;
  elderlyId: number;
  elderlyName?: string | null;
  initialRoutine?: DailyRoutineOverviewDto | null;
  onClose: () => void;
  onSaved: (updated?: DailyRoutineOverviewDto) => void;
}

const WATER_ML_MIN = 1000;
const WATER_ML_MAX = 2000;
const WATER_ML_STEP = 100;
const WATER_LITER_PRESETS = [1300, 1400, 1500, 1600];
const WATER_CUP_ML_OPTIONS = [150, 200, 250, 300];
const SLEEP_HOURS_MIN = 6;
const SLEEP_HOURS_MAX = 10;

const DEFAULT_WATER_TIMES = ['08:00', '10:00', '14:00', '16:00', '19:00', '20:30'];
const WATER_PRESET_TIMES = [
  '07:30',
  '08:00',
  '09:30',
  '10:00',
  '12:00',
  '14:00',
  '15:30',
  '16:00',
  '18:00',
  '19:00',
  '20:30',
];
const BEDTIME_PRESETS = ['21:00', '21:30', '22:00', '22:30'];
const WAKEUP_PRESETS = ['05:30', '06:00', '06:30'];

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

export function parseValidHHMM(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})[:hH](\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getPlusOneMinuteHHMM(): string {
  const next = new Date(Date.now() + 60_000);
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}

export function normalizeRoutineTimes(times?: string[] | null): string[] {
  if (!Array.isArray(times)) return [];
  const valid = times
    .map((item) => parseValidHHMM(item))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(valid)).sort();
}

export function formatRoutineTimesSummary(
  times?: string[] | null,
  enabled = true,
  maxItems = 5
): string {
  if (!enabled) return 'Đang tắt nhắc uống nước';
  const normalized = normalizeRoutineTimes(times);
  if (normalized.length === 0) return 'Chưa đặt khung giờ nhắc';
  if (normalized.length <= maxItems) {
    return normalized.join(' • ');
  }
  const head = normalized.slice(0, maxItems).join(' • ');
  return `${head} (+${normalized.length - maxItems})`;
}

export function getSleepStatusMeta(routine?: DailyRoutineOverviewDto | null, palette = lightColors) {
  if (routine?.sleepStatus === 'COMPLETED') {
    const timeLabel = routine.sleepCompletedAt ? formatTimeHHMM(routine.sleepCompletedAt) : null;
    const validTime = timeLabel && timeLabel !== '--:--' ? ` lúc ${timeLabel}` : '';
    return {
      isCompleted: true,
      label: `Đã đi ngủ${validTime}`,
      badgeLabel: 'Đã đi ngủ',
      bg: palette.success,
      border: palette.successBorder,
      text: palette.successText,
      icon: 'check-circle' as const,
    };
  }

  return {
    isCompleted: false,
    label: 'Chưa tới giờ / Chờ xác nhận',
    badgeLabel: 'Chưa tới giờ / Chờ xác nhận',
    bg: palette.warning,
    border: palette.warningBorder,
    text: palette.warningText,
    icon: 'clock' as const,
  };
}

export const CaregiverRoutineModal: React.FC<CaregiverRoutineModalProps> = ({
  visible,
  elderlyId,
  elderlyName,
  initialRoutine,
  onClose,
  onSaved,
}) => {
  const { isDark, c: colors, fs } = useCaregiverTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [waterEnabled, setWaterEnabled] = useState(true);
  const [waterTargetMl, setWaterTargetMl] = useState(1400);
  const [waterCupMl, setWaterCupMl] = useState(200);
  const [waterReminderTimes, setWaterReminderTimes] = useState<string[]>(DEFAULT_WATER_TIMES);
  const [customWaterTime, setCustomWaterTime] = useState('');

  const [sleepEnabled, setSleepEnabled] = useState(true);
  const [bedtimeTime, setBedtimeTime] = useState('21:30');
  const [wakeupTime, setWakeupTime] = useState('06:00');
  const [sleepTargetHours, setSleepTargetHours] = useState(8);

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  const wasVisibleRef = useRef(false);

  const derivedTargetCups = Math.max(1, Math.ceil(waterTargetMl / Math.max(50, waterCupMl)));
  const formatLiters = (ml: number) => (ml % 100 === 0 ? (ml / 1000).toFixed(1) : (ml / 1000).toFixed(2));

  const applyRoutineToForm = (routine?: DailyRoutineOverviewDto | null) => {
    if (!routine) {
      setWaterEnabled(true);
      setWaterTargetMl(1400);
      setWaterCupMl(200);
      setWaterReminderTimes(DEFAULT_WATER_TIMES);
      setSleepEnabled(true);
      setBedtimeTime('21:30');
      setWakeupTime('06:00');
      setSleepTargetHours(8);
      return;
    }

    const cupMl = WATER_CUP_ML_OPTIONS.includes(routine.waterCupMl ?? 0)
      ? (routine.waterCupMl as number)
      : clampInt(routine.waterCupMl ?? 200, 100, 500);
    const targetMl = clampInt(
      routine.waterTargetMl ?? (routine.waterTargetCups ? routine.waterTargetCups * cupMl : 1400),
      WATER_ML_MIN,
      WATER_ML_MAX
    );
    setWaterEnabled(routine.waterEnabled ?? true);
    setWaterCupMl(cupMl);
    setWaterTargetMl(targetMl);
    const parsedTimes = normalizeRoutineTimes(routine.waterReminderTimes);
    setWaterReminderTimes(parsedTimes.length > 0 ? parsedTimes : DEFAULT_WATER_TIMES);
    setSleepEnabled(routine.sleepEnabled ?? true);
    setBedtimeTime(parseValidHHMM(routine.bedtimeTime || '') || '21:30');
    setWakeupTime(parseValidHHMM(routine.wakeupTime || '') || '06:00');
    setSleepTargetHours(
      clampInt(routine.sleepTargetHours ?? 8, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX)
    );
  };

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!justOpened) return;

    setCustomWaterTime('');
    applyRoutineToForm(initialRoutine);

    if (initialRoutine) return;

    let cancelled = false;
    const loadLatestConfig = async () => {
      try {
        setLoadingConfig(true);
        const res = await apiClient<DailyRoutineOverviewDto>(
          `/api/routines/today?elderlyId=${elderlyId}`
        );
        if (!cancelled && res.success && res.data) {
          applyRoutineToForm(res.data);
        }
      } catch {
        // Keep defaults if initial fetch fails
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    };

    loadLatestConfig();
    return () => {
      cancelled = true;
    };
  }, [visible, elderlyId, initialRoutine]);

  const toggleWaterTime = (time: string) => {
    setWaterReminderTimes((prev) =>
      prev.includes(time) ? prev.filter((item) => item !== time) : [...prev, time].sort()
    );
  };

  const removeWaterTime = (time: string) => {
    setWaterReminderTimes((prev) => prev.filter((item) => item !== time));
  };

  const handleAddCustomWaterTime = () => {
    const normalized = parseValidHHMM(customWaterTime);
    if (!normalized) {
      Alert.alert(
        'Giờ không hợp lệ',
        'Vui lòng nhập đúng định dạng HH:mm (ví dụ: 09:30 hoặc 15:45).'
      );
      return;
    }
    setWaterReminderTimes((prev) => Array.from(new Set([...prev, normalized])).sort());
    setCustomWaterTime('');
  };

  const handleAddTestPlusOneMinuteWater = () => {
    const testTime = getPlusOneMinuteHHMM();
    setWaterEnabled(true);
    setWaterReminderTimes((prev) => Array.from(new Set([...prev, testTime])).sort());
  };

  const handleSetTestPlusOneMinuteBedtime = () => {
    setSleepEnabled(true);
    setBedtimeTime(getPlusOneMinuteHHMM());
  };

  const handleSave = async () => {
    const normalizedBedtime = parseValidHHMM(bedtimeTime);
    if (!normalizedBedtime) {
      Alert.alert(
        'Giờ đi ngủ không hợp lệ',
        'Vui lòng nhập giờ đi ngủ đúng định dạng HH:mm (ví dụ: 21:30).'
      );
      return;
    }

    const normalizedWakeup = parseValidHHMM(wakeupTime);
    if (!normalizedWakeup) {
      Alert.alert(
        'Giờ thức dậy không hợp lệ',
        'Vui lòng nhập giờ thức dậy đúng định dạng HH:mm (ví dụ: 06:00).'
      );
      return;
    }

    const sortedWaterTimes = normalizeRoutineTimes(waterReminderTimes);
    if (waterEnabled && sortedWaterTimes.length === 0) {
      Alert.alert(
        'Chưa chọn giờ nhắc uống nước',
        'Vui lòng chọn ít nhất một khung giờ nhắc uống nước hoặc tắt nhắc uống nước.'
      );
      return;
    }

    const payload: CaregiverRoutineConfigPayload = {
      waterTargetCups: derivedTargetCups,
      waterTargetMl: clampInt(waterTargetMl, WATER_ML_MIN, WATER_ML_MAX),
      waterCupMl: clampInt(waterCupMl, 100, 500),
      waterReminderTimes: sortedWaterTimes,
      bedtimeTime: normalizedBedtime,
      wakeupTime: normalizedWakeup,
      sleepTargetHours: clampInt(sleepTargetHours, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX),
      waterEnabled,
      sleepEnabled,
    };

    try {
      setSaving(true);
      const res = await apiClient<DailyRoutineOverviewDto>(
        `/api/routines/config?elderlyId=${elderlyId}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );

      if (res.success) {
        Alert.alert(
          'Đã lưu lịch sinh hoạt',
          `Đã cập nhật lịch uống nước và giấc ngủ${elderlyName ? ` cho ${elderlyName}` : ''}.`
        );
        onSaved(res.data);
        onClose();
      } else {
        Alert.alert('Không thể lưu', res.message || 'Đã xảy ra lỗi khi lưu lịch sinh hoạt.');
      }
    } catch (err: any) {
      Alert.alert('Không thể lưu', err?.message || 'Đã xảy ra lỗi khi lưu lịch sinh hoạt.');
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
                  Thiết lập Nước uống & Giấc ngủ
                </Text>
                <Text style={[styles.subtitle, { fontSize: fs(12.5) }]}>
                  {elderlyName
                    ? `Áp dụng cho: ${elderlyName}`
                    : 'Nhắc nhở sinh hoạt hằng ngày cho người thân'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Đóng thiết lập sinh hoạt"
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingConfig ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { fontSize: fs(13) }]}>
                  Đang tải cấu hình hiện tại...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formScrollContent}
              >
                {/* SECTION 1: WATER */}
                <View style={styles.sectionBox}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                      <View style={[styles.sectionIconBadge, styles.waterIconBadge]}>
                        <Feather name="droplet" size={16} color={colors.primaryDark} />
                      </View>
                      <View style={styles.sectionTitleCol}>
                        <Text style={[styles.sectionTitle, { fontSize: fs(15.5) }]}>
                          Uống nước
                        </Text>
                        <Text style={[styles.sectionHint, { fontSize: fs(12) }]}>
                          {waterEnabled ? 'Đang bật nhắc nhở' : 'Đang tạm tắt'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={waterEnabled}
                      onValueChange={setWaterEnabled}
                      disabled={saving}
                      trackColor={{ false: colors.border, true: colors.secondary }}
                      thumbColor={waterEnabled ? colors.primary : colors.surface}
                    />
                  </View>

                  <View style={styles.clinicalHydrationNote}>
                    <Feather
                      name="info"
                      size={14}
                      color={isDark ? colors.textSecondary : '#0369A1'}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={[styles.clinicalHydrationNoteText, { fontSize: fs(11.8) }]}>
                      Khuyến cáo 1.6–2.0L/ngày gồm cả cháo, súp, sữa. Riêng nước lọc nên đặt tối thiểu 1.3–1.6L/ngày và chia thành từng ly.
                    </Text>
                  </View>

                  <Text style={[styles.label, { fontSize: fs(13) }]}>
                    Mục tiêu nước lọc mỗi ngày (khuyên dùng 1.3 – 1.6 L)
                  </Text>
                  <View style={styles.chipWrap}>
                    {WATER_LITER_PRESETS.map((ml) => {
                      const active = waterTargetMl === ml;
                      return (
                        <TouchableOpacity
                          key={`preset-ml-${ml}`}
                          style={[styles.chip, active && styles.waterChipActive]}
                          onPress={() => setWaterTargetMl(ml)}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { fontSize: fs(12.5) },
                              active && (isDark ? styles.chipTextActive : styles.waterChipTextActive),
                            ]}
                          >
                            {formatLiters(ml)} L ({ml}ml)
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.stepperRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        waterTargetMl <= WATER_ML_MIN && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setWaterTargetMl((prev) =>
                          clampInt(prev - WATER_ML_STEP, WATER_ML_MIN, WATER_ML_MAX)
                        )
                      }
                      disabled={saving || waterTargetMl <= WATER_ML_MIN}
                      accessibilityLabel="Giảm lượng nước lọc mục tiêu"
                    >
                      <Feather
                        name="minus"
                        size={17}
                        color={
                          waterTargetMl <= WATER_ML_MIN
                            ? colors.textMuted
                            : isDark
                              ? colors.primaryDark
                              : '#0369A1'
                        }
                      />
                    </TouchableOpacity>
                    <View style={styles.stepperValueBox}>
                      <MaterialCommunityIcons
                        name="cup-water"
                        size={18}
                        color={isDark ? colors.primary : '#0284C7'}
                      />
                      <Text
                        style={[
                          styles.stepperValueText,
                          { fontSize: fs(14.5), color: isDark ? colors.textPrimary : '#0369A1' },
                        ]}
                      >
                        {formatLiters(waterTargetMl)} L / ngày • {derivedTargetCups} ly ({waterCupMl}ml/ly)
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        waterTargetMl >= WATER_ML_MAX && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setWaterTargetMl((prev) =>
                          clampInt(prev + WATER_ML_STEP, WATER_ML_MIN, WATER_ML_MAX)
                        )
                      }
                      disabled={saving || waterTargetMl >= WATER_ML_MAX}
                      accessibilityLabel="Tăng lượng nước lọc mục tiêu"
                    >
                      <Feather
                        name="plus"
                        size={17}
                        color={
                          waterTargetMl >= WATER_ML_MAX
                            ? colors.textMuted
                            : isDark
                              ? colors.primaryDark
                              : '#0369A1'
                        }
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.subLabel, { fontSize: fs(12) }]}>
                    Dung tích 1 ly nước (hệ thống tự chia số ly mỗi ngày)
                  </Text>
                  <View style={styles.chipWrap}>
                    {WATER_CUP_ML_OPTIONS.map((cupSize) => {
                      const active = waterCupMl === cupSize;
                      return (
                        <TouchableOpacity
                          key={`cup-size-${cupSize}`}
                          style={[styles.chip, active && styles.waterChipActive]}
                          onPress={() => setWaterCupMl(cupSize)}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { fontSize: fs(12) },
                              active && (isDark ? styles.chipTextActive : styles.waterChipTextActive),
                            ]}
                          >
                            {cupSize} ml/ly
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.labelWithActionRow}>
                    <Text style={[styles.label, styles.labelNoMargin, { fontSize: fs(13) }]}>
                      Giờ nhắc đã chọn ({waterReminderTimes.length} khung giờ)
                    </Text>
                    <TouchableOpacity
                      style={styles.quickTestBtn}
                      onPress={handleAddTestPlusOneMinuteWater}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Feather name="zap" size={12} color={colors.accentDark} />
                      <Text style={[styles.quickTestBtnText, { fontSize: fs(11.5) }]}>
                        +1 phút sau hiện tại để test
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {waterReminderTimes.length === 0 ? (
                    <Text style={[styles.emptyTimesText, { fontSize: fs(12.5) }]}>
                      Chưa chọn giờ nhắc nào. Chọn bên dưới hoặc thêm giờ tùy chỉnh.
                    </Text>
                  ) : (
                    <View style={styles.selectedPillsWrap}>
                      {waterReminderTimes.map((time) => (
                        <View key={`selected-${time}`} style={styles.selectedPill}>
                          <Feather name="clock" size={12} color={colors.textInverse} />
                          <Text style={[styles.selectedPillText, { fontSize: fs(12.5) }]}>
                            {time}
                          </Text>
                          <TouchableOpacity
                            style={styles.selectedPillRemoveBtn}
                            onPress={() => removeWaterTime(time)}
                            disabled={saving}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityLabel={`Xóa giờ ${time}`}
                          >
                            <Feather name="x" size={12} color={colors.textInverse} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={[styles.subLabel, { fontSize: fs(12) }]}>Chọn nhanh khung giờ</Text>
                  <View style={styles.chipWrap}>
                    {WATER_PRESET_TIMES.map((time) => {
                      const active = waterReminderTimes.includes(time);
                      return (
                        <TouchableOpacity
                          key={`preset-water-${time}`}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleWaterTime(time)}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { fontSize: fs(12) },
                              active && styles.chipTextActive,
                            ]}
                          >
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
                        placeholder="Giờ khác (VD: 15:30)"
                        placeholderTextColor={colors.textMuted}
                        value={customWaterTime}
                        onChangeText={setCustomWaterTime}
                        keyboardType="numbers-and-punctuation"
                        editable={!saving}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.addCustomTimeBtn}
                      onPress={handleAddCustomWaterTime}
                      disabled={saving}
                    >
                      <Text style={[styles.addCustomTimeBtnText, { fontSize: fs(13) }]}>
                        Thêm giờ
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SECTION 2: SLEEP */}
                <View style={styles.sectionBox}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                      <View style={[styles.sectionIconBadge, styles.sleepIconBadge]}>
                        <Feather name="moon" size={16} color={colors.accentDark} />
                      </View>
                      <View style={styles.sectionTitleCol}>
                        <Text style={[styles.sectionTitle, { fontSize: fs(15.5) }]}>
                          Giấc ngủ
                        </Text>
                        <Text style={[styles.sectionHint, { fontSize: fs(12) }]}>
                          {sleepEnabled ? 'Đang bật nhắc giờ ngủ' : 'Đang tạm tắt'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={sleepEnabled}
                      onValueChange={setSleepEnabled}
                      disabled={saving}
                      trackColor={{ false: colors.border, true: colors.secondary }}
                      thumbColor={sleepEnabled ? colors.primary : colors.surface}
                    />
                  </View>

                  <View style={styles.labelWithActionRow}>
                    <Text style={[styles.label, styles.labelNoMargin, { fontSize: fs(13) }]}>
                      Giờ đi ngủ (HH:mm)
                    </Text>
                    <TouchableOpacity
                      style={styles.quickTestBtn}
                      onPress={handleSetTestPlusOneMinuteBedtime}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Feather name="zap" size={12} color={colors.accentDark} />
                      <Text style={[styles.quickTestBtnText, { fontSize: fs(11.5) }]}>
                        +1 phút để test
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputRow}>
                    <Feather name="moon" size={16} color={colors.primary} />
                    <TextInput
                      style={[styles.textInput, { fontSize: fs(14.5) }]}
                      placeholder="21:30"
                      placeholderTextColor={colors.textMuted}
                      value={bedtimeTime}
                      onChangeText={setBedtimeTime}
                      keyboardType="numbers-and-punctuation"
                      editable={!saving}
                    />
                  </View>
                  <View style={styles.chipWrap}>
                    {BEDTIME_PRESETS.map((time) => {
                      const active = bedtimeTime.trim() === time;
                      return (
                        <TouchableOpacity
                          key={`bed-${time}`}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setBedtimeTime(time)}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { fontSize: fs(12.5) },
                              active && styles.chipTextActive,
                            ]}
                          >
                            {time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.label, { fontSize: fs(13) }]}>Giờ thức dậy (HH:mm)</Text>
                  <View style={styles.inputRow}>
                    <Feather name="sun" size={16} color={colors.accentDark} />
                    <TextInput
                      style={[styles.textInput, { fontSize: fs(14.5) }]}
                      placeholder="06:00"
                      placeholderTextColor={colors.textMuted}
                      value={wakeupTime}
                      onChangeText={setWakeupTime}
                      keyboardType="numbers-and-punctuation"
                      editable={!saving}
                    />
                  </View>
                  <View style={styles.chipWrap}>
                    {WAKEUP_PRESETS.map((time) => {
                      const active = wakeupTime.trim() === time;
                      return (
                        <TouchableOpacity
                          key={`wake-${time}`}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setWakeupTime(time)}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { fontSize: fs(12.5) },
                              active && styles.chipTextActive,
                            ]}
                          >
                            {time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.label, { fontSize: fs(13) }]}>
                    Mục tiêu giấc ngủ ({SLEEP_HOURS_MIN}–{SLEEP_HOURS_MAX} giờ)
                  </Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        sleepTargetHours <= SLEEP_HOURS_MIN && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setSleepTargetHours((prev) =>
                          clampInt(prev - 1, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX)
                        )
                      }
                      disabled={saving || sleepTargetHours <= SLEEP_HOURS_MIN}
                      accessibilityLabel="Giảm số giờ ngủ mục tiêu"
                    >
                      <Feather
                        name="minus"
                        size={17}
                        color={
                          sleepTargetHours <= SLEEP_HOURS_MIN
                            ? colors.textMuted
                            : colors.primaryDark
                        }
                      />
                    </TouchableOpacity>
                    <View style={styles.stepperValueBox}>
                      <Feather name="clock" size={16} color={colors.primary} />
                      <Text style={[styles.stepperValueText, { fontSize: fs(15.5) }]}>
                        {sleepTargetHours} giờ / đêm
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        sleepTargetHours >= SLEEP_HOURS_MAX && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setSleepTargetHours((prev) =>
                          clampInt(prev + 1, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX)
                        )
                      }
                      disabled={saving || sleepTargetHours >= SLEEP_HOURS_MAX}
                      accessibilityLabel="Tăng số giờ ngủ mục tiêu"
                    >
                      <Feather
                        name="plus"
                        size={17}
                        color={
                          sleepTargetHours >= SLEEP_HOURS_MAX
                            ? colors.textMuted
                            : colors.primaryDark
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.cancelBtnText, { fontSize: fs(14) }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (saving || loadingConfig) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || loadingConfig}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={[styles.saveBtnText, { fontSize: fs(14) }]}>
                    Lưu thiết lập
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
  clinicalHydrationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: isDark ? colors.surfaceWarm : '#E0F2FE',
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  clinicalHydrationNoteText: {
    flex: 1,
    color: isDark ? colors.textSecondary : '#075985',
    fontWeight: '600',
    lineHeight: 17,
  },
  waterChipActive: {
    backgroundColor: isDark ? colors.primaryLight : '#0284C7',
    borderColor: isDark ? colors.primary : '#0369A1',
  },
  waterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
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
    marginBottom: 10,
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
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  formScrollContent: {
    paddingBottom: 10,
    gap: 14,
  },
  sectionBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  waterIconBadge: {
    backgroundColor: colors.primaryLight,
  },
  sleepIconBadge: {
    backgroundColor: colors.accentLight,
  },
  sectionTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  label: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  labelNoMargin: {
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
    minWidth: 0,
  },
  labelWithActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  subLabel: {
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 10,
  },
  quickTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  quickTestBtnText: {
    fontWeight: '700',
    color: colors.accentDark,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.borderLight,
    opacity: 0.6,
  },
  stepperValueBox: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  stepperValueText: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  selectedPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 10,
    paddingRight: 7,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  selectedPillText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  selectedPillRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: isDark ? 'rgba(11, 11, 13, 0.14)' : 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTimesText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
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
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontWeight: '700',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chipTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
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
    textAlign: 'center',
  },
});
