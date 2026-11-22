import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import { SOSButton } from '../../components/SOSButton';
import { getAvatarSource } from '../../core/theme/avatar';
import {
  useCareRoutineStore,
  extractHHmm,
  resolveWaterMetrics,
} from '../../core/routines/useCareRoutineStore';
import {
  useDueRemindersState,
  stopReminderSoundImmediately,
  type DueReminderItem,
} from '../../core/routines/useElderlyReminderEngine';

interface CheckInRecord {
  id: number;
  checkInDate: string;
  mood: string;
  physicalHealth: string;
  sleepQuality?: string;
  appetite?: string;
  aiAnalysis?: string;
}

interface UpcomingPreviewItem {
  key: string;
  kind: 'MEDICATION' | 'WATER' | 'SLEEP';
  logId: number;
  time: string;
  kicker: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
}

interface Props {
  onNavigateTab: (tab: 'home' | 'companion' | 'medication' | 'checkin' | 'profile') => void;
}

export const ElderlyHomeScreen: React.FC<Props> = ({ onNavigateTab }) => {
  const { user } = useAuthStore();
  const { fs } = useAccessibilityStore();

  const todayMeds = useCareRoutineStore((s) => s.todayMeds);
  const todayRoutine = useCareRoutineStore((s) => s.todayRoutine);
  const storeLoading = useCareRoutineStore((s) => s.loading);
  const lastSyncedAt = useCareRoutineStore((s) => s.lastSyncedAt);
  const confirmingKey = useCareRoutineStore((s) => s.confirmingKey);
  const fetchElderlyTodayData = useCareRoutineStore((s) => s.fetchElderlyTodayData);
  const confirmMedicationLog = useCareRoutineStore((s) => s.confirmMedicationLog);
  const confirmRoutineLog = useCareRoutineStore((s) => s.confirmRoutineLog);

  const {
    dueReminders,
    activeAlarmReminder,
    isAlarmMuted,
    confirmReminder,
    muteAlarm,
    unmuteAlarm,
  } = useDueRemindersState();

  const [todayCheckIn, setTodayCheckIn] = useState<CheckInRecord | null>(null);
  const [checkInLoaded, setCheckInLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHomeData = async (silent = false) => {
    try {
      const [, checkInRes] = await Promise.allSettled([
        fetchElderlyTodayData(silent),
        apiClient<CheckInRecord>('/api/checkins/today'),
      ]);

      if (checkInRes.status === 'fulfilled' && checkInRes.value.success) {
        setTodayCheckIn(checkInRes.value.data || null);
      }
    } catch {
      // Handled
    } finally {
      setCheckInLoaded(true);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomeData(lastSyncedAt !== null);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHomeData(true);
  };

  const handleConfirmDueReminder = async (reminder: DueReminderItem) => {
    try {
      const ok = await confirmReminder(reminder);
      if (ok) {
        const successMsg =
          reminder.kind === 'SLEEP'
            ? 'Đã ghi nhận cụ chuẩn bị đi ngủ! Chúc cụ một giấc ngủ thật ngon và sâu giấc.'
            : reminder.kind === 'WATER'
              ? 'Đã ghi nhận cụ vừa uống nước! Cơ thể đủ nước sẽ giúp cụ khỏe khoắn hơn.'
              : 'Cảm ơn cụ đã uống thuốc đúng giờ! Chúc cụ luôn dồi dào sức khỏe.';
        Alert.alert('Đã ghi nhận', successMsg);
      } else {
        Alert.alert('Thông báo', 'Không thể xác nhận lúc này. Cụ vui lòng thử lại nhé.');
      }
    } catch (err: any) {
      Alert.alert('Thông báo', err?.message || 'Không thể xác nhận lúc này.');
    }
  };

  const handleConfirmUpcomingItem = async (item: UpcomingPreviewItem) => {
    stopReminderSoundImmediately();
    try {
      if (item.kind === 'MEDICATION') {
        const ok = await confirmMedicationLog(item.logId, 'Xác nhận trực tiếp từ màn hình chính');
        if (ok) {
          Alert.alert('Đã ghi nhận', 'Cảm ơn cụ đã uống thuốc đúng giờ! Chúc cụ luôn dồi dào sức khỏe.');
        }
      } else {
        const note = item.kind === 'SLEEP' ? 'Tôi đã đi ngủ đúng giờ' : 'Tôi đã uống nước đúng giờ';
        const res = await confirmRoutineLog(item.logId, note);
        if (res) {
          Alert.alert(
            'Đã ghi nhận',
            item.kind === 'SLEEP'
              ? 'Đã ghi nhận cụ chuẩn bị đi ngủ! Chúc cụ ngủ ngon ạ.'
              : 'Đã ghi nhận cụ vừa uống nước! Rất tốt cho sức khỏe ạ.'
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Thông báo', err?.message || 'Không thể xác nhận lúc này.');
    }
  };

  const takenCount = todayMeds.filter((m) => m.status === 'TAKEN').length;
  const totalMeds = todayMeds.length;

  const nextUpcomingItem = useMemo<UpcomingPreviewItem | null>(() => {
    const candidates: UpcomingPreviewItem[] = [];

    const nextMed = todayMeds.find((m) => m.status === 'PENDING');
    if (nextMed) {
      const time = extractHHmm(nextMed.scheduledTime) || 'Đúng giờ';
      candidates.push({
        key: `MEDICATION:${nextMed.id}`,
        kind: 'MEDICATION',
        logId: nextMed.id,
        time,
        kicker: `Cữ thuốc hôm nay • ${time}`,
        title: nextMed.medicationName,
        subtitle: `Liều dùng: ${nextMed.dosage}${nextMed.instruction ? ` • ${nextMed.instruction}` : ''}`,
        confirmLabel: 'Tôi đã uống thuốc này',
      });
    }

    if (todayRoutine?.waterEnabled) {
      const nextWater = todayRoutine.logs?.find(
        (l) => l.routineType === 'WATER' && l.status === 'PENDING'
      );
      if (nextWater) {
        const time = extractHHmm(nextWater.scheduledTime) || 'Hôm nay';
        const water = resolveWaterMetrics(todayRoutine);
        candidates.push({
          key: `WATER:${nextWater.id}`,
          kind: 'WATER',
          logId: nextWater.id,
          time,
          kicker: `Nhắc uống nước • ${time}`,
          title: `Uống 1 ly nước lọc (${water.cupMl}ml)`,
          subtitle: `${water.completedLitersLabel}/${water.targetLitersLabel} L (${water.completedCups}/${water.targetCups} ly hôm nay)`,
          confirmLabel: 'Tôi đã uống',
        });
      }
    }

    if (todayRoutine?.sleepEnabled) {
      const nextSleep = todayRoutine.logs?.find(
        (l) => l.routineType === 'SLEEP' && l.status === 'PENDING'
      );
      if (nextSleep) {
        const time = extractHHmm(nextSleep.scheduledTime) || todayRoutine.bedtimeTime;
        candidates.push({
          key: `SLEEP:${nextSleep.id}`,
          kind: 'SLEEP',
          logId: nextSleep.id,
          time,
          kicker: `Giờ nghỉ ngơi • ${time}`,
          title: 'Chuẩn bị đi ngủ',
          subtitle: `Ngủ ${todayRoutine.bedtimeTime} • Dậy ${todayRoutine.wakeupTime} (${todayRoutine.sleepTargetHours}h)`,
          confirmLabel: 'Tôi đã đi ngủ',
        });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.time.localeCompare(b.time));
    return candidates[0];
  }, [todayMeds, todayRoutine]);

  const nextPendingWaterTime = useMemo(() => {
    const slot = todayRoutine?.logs?.find(
      (l) => l.routineType === 'WATER' && l.status === 'PENDING'
    );
    return slot ? extractHHmm(slot.scheduledTime) : null;
  }, [todayRoutine]);

  const isInitialLoading = (storeLoading || !checkInLoaded) && lastSyncedAt === null;

  const getDueCardPalette = (kind: DueReminderItem['kind']) => {
    if (kind === 'WATER') {
      return {
        bg: '#EAF4FB',
        border: '#60A5FA',
        badgeBg: '#0284C7',
        titleColor: '#0C4A6E',
      };
    }
    if (kind === 'SLEEP') {
      return {
        bg: '#EEF0FB',
        border: '#818CF8',
        badgeBg: '#4F46E5',
        titleColor: '#312E81',
      };
    }
    return {
      bg: '#FEF3E7',
      border: '#F59E0B',
      badgeBg: '#D97706',
      titleColor: '#78350F',
    };
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Eldora-Style Greeting Top Bar */}
      <View style={styles.topGreetingBar}>
        <View style={styles.greetingTextCol}>
          <Text style={[styles.greetingSub, { fontSize: fs(14) }]}>Chào buổi sáng,</Text>
          <Text style={[styles.greetingName, { fontSize: fs(24) }]}>
            {user?.fullName || 'Người cao tuổi'}
          </Text>
          <Text style={[styles.greetingQuestion, { fontSize: fs(13) }]}>
            Hôm nay cụ cảm thấy thế nào ạ?
          </Text>
        </View>

        {/* Senior Photo Avatar Box */}
        <TouchableOpacity
          style={styles.seniorAvatarBox}
          onPress={() => onNavigateTab('profile')}
          activeOpacity={0.8}
          accessibilityLabel="Xem hồ sơ"
        >
          <Image
            source={getAvatarSource(user?.avatarUrl)}
            style={styles.seniorAvatarImg}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* 2. Emergency SOS Access (Discrete, non-overlapping) */}
      <View style={styles.sosContainer}>
        <SOSButton emergencyContactName="Con gái (Nguyễn Thị Hoa)" />
      </View>

      {/* 2b. Prominent Due Reminder Alert Card (Water / Medication / Sleep) */}
      {activeAlarmReminder && (() => {
        const palette = getDueCardPalette(activeAlarmReminder.kind);
        const isConfirmingDue = confirmingKey === activeAlarmReminder.key;

        return (
          <View style={styles.sectionWrap}>
            <View
              style={[
                styles.dueAlertCard,
                { backgroundColor: palette.bg, borderColor: palette.border },
              ]}
              accessibilityRole="alert"
            >
              <View style={styles.dueAlertHeader}>
                <View style={[styles.dueBellBadge, { backgroundColor: palette.badgeBg }]}>
                  <Feather
                    name={isAlarmMuted ? 'bell-off' : 'volume-2'}
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.dueBellBadgeText, { fontSize: fs(12) }]}>
                    {activeAlarmReminder.title}
                  </Text>
                </View>

                <View style={styles.dueTimePill}>
                  <Feather name="clock" size={13} color={palette.titleColor} style={{ marginRight: 4 }} />
                  <Text style={[styles.dueTimeText, { color: palette.titleColor, fontSize: fs(13) }]}>
                    {activeAlarmReminder.scheduledTime}
                  </Text>
                </View>
              </View>

              <Text style={[styles.dueSubtitle, { fontSize: fs(16) }]}>
                {activeAlarmReminder.subtitle}
              </Text>

              {dueReminders.length > 1 && (
                <View style={styles.dueExtraBox}>
                  <Text style={[styles.dueExtraLabel, { fontSize: fs(12) }]}>
                    Còn {dueReminders.length - 1} lời nhắc đến giờ khác:
                  </Text>
                  <View style={styles.dueExtraChips}>
                    {dueReminders.slice(1, 3).map((extra) => (
                      <View key={extra.key} style={styles.dueExtraChip}>
                        <Text style={[styles.dueExtraChipText, { fontSize: fs(11.5) }]}>
                          {extra.scheduledTime} •{' '}
                          {extra.kind === 'MEDICATION'
                            ? 'Uống thuốc'
                            : extra.kind === 'WATER'
                              ? 'Uống nước'
                              : 'Đi ngủ'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.dueActionsRow}>
                <TouchableOpacity
                  style={styles.duePrimaryBtn}
                  onPress={() => handleConfirmDueReminder(activeAlarmReminder)}
                  disabled={isConfirmingDue}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={activeAlarmReminder.confirmLabel}
                >
                  {isConfirmingDue ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.duePrimaryBtnInner}>
                      <Feather name="check-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={[styles.duePrimaryBtnText, { fontSize: fs(17) }]}>
                        {activeAlarmReminder.confirmLabel}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dueMuteBtn}
                  onPress={isAlarmMuted ? unmuteAlarm : muteAlarm}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={isAlarmMuted ? 'Bật chuông' : 'Tắt chuông'}
                >
                  <Feather
                    name={isAlarmMuted ? 'volume-2' : 'volume-x'}
                    size={16}
                    color={colors.textPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.dueMuteBtnText, { fontSize: fs(12.5) }]}>
                    {isAlarmMuted ? 'Bật chuông' : 'Tắt chuông'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

      {isInitialLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>
            Đang tải thông tin sức khỏe của cụ...
          </Text>
        </View>
      ) : (
        <>
          {/* 3. Daily Wellness Card (Eldora-Style Peach/Cream Hero) */}
          <View style={styles.sectionWrap}>
            <View style={styles.dailyWellnessCard}>
              <View style={styles.wellnessLeftCol}>
                <View style={styles.wellnessBadge}>
                  <Text style={[styles.wellnessBadgeText, { fontSize: fs(11) }]}>
                    SỨC KHỎE HÔM NAY
                  </Text>
                </View>
                <Text style={[styles.wellnessTitle, { fontSize: fs(18) }]}>
                  {todayCheckIn ? 'Đã hoàn thành điểm danh' : 'Điểm danh sức khỏe'}
                </Text>
                <Text style={[styles.wellnessDesc, { fontSize: fs(12.5) }]}>
                  {todayCheckIn
                    ? `Tâm trạng: ${todayCheckIn.mood} • Thể trạng: ${todayCheckIn.physicalHealth}`
                    : 'Chăm sóc sức khỏe cụ hôm nay cùng gia đình'}
                </Text>

                <TouchableOpacity
                  style={[styles.wellnessBtn, todayCheckIn && styles.wellnessBtnDone]}
                  onPress={() => onNavigateTab('checkin')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.wellnessBtnText, { fontSize: fs(13) }]}>
                    {todayCheckIn ? 'Xem lại kết quả' : 'Điểm danh ngay'}
                  </Text>
                  <Feather
                    name={todayCheckIn ? 'check' : 'arrow-right'}
                    size={14}
                    color="#FFFFFF"
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.wellnessRightCol}>
                <View style={styles.smileFaceCircle}>
                  <Feather
                    name={todayCheckIn ? 'check-circle' : 'smile'}
                    size={28}
                    color={todayCheckIn ? colors.successText : colors.primary}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 4. Quick Actions Grid: "Cụ muốn làm gì hôm nay?" (Eldora 3x2 Grid with Vector Icons) */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.gridSectionTitle, { fontSize: fs(17) }]}>
              Cụ muốn làm gì hôm nay?
            </Text>

            <View style={styles.actionsGrid}>
              {/* Item 1: Sức khỏe */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('checkin')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#FBEBEB' }]}>
                  <Feather name="activity" size={20} color="#B83232" />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Sức khỏe</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>Điểm danh</Text>
              </TouchableOpacity>

              {/* Item 2: Thuốc uống */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('medication')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#EAF3F9' }]}>
                  <MaterialCommunityIcons name="pill" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Thuốc uống</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>
                  {totalMeds > 0 ? `${takenCount}/${totalMeds} cữ` : 'Nhắc cữ'}
                </Text>
              </TouchableOpacity>

              {/* Item 3: Trò chuyện AI */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('companion')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#EDF5EF' }]}>
                  <Feather name="message-circle" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Trợ lý AI</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>Tâm sự cùng cụ</Text>
              </TouchableOpacity>

              {/* Item 4: Gia đình */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('profile')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#FDF4E7' }]}>
                  <Feather name="users" size={20} color="#995C17" />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Gia đình</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>Con cháu</Text>
              </TouchableOpacity>

              {/* Item 5: Trợ giúp khẩn cấp */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => {
                  Alert.alert(
                    'Trợ giúp khẩn cấp SOS',
                    'Cụ có thể nhấn nút "Cần trợ giúp khẩn cấp?" ở đầu trang để gửi thông báo ngay cho con gái Nguyễn Thị Hoa.'
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#FBEBEB' }]}>
                  <Feather name="alert-triangle" size={20} color={colors.dangerText} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Khẩn cấp</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>Hỗ trợ SOS</Text>
              </TouchableOpacity>

              {/* Item 6: Cài đặt / Cỡ chữ */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('profile')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#F3EFE6' }]}>
                  <Feather name="type" size={20} color={colors.textPrimary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>Cỡ chữ</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>Điều chỉnh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 5. Upcoming (Sắp tới - Thuốc, Nước uống & Giấc ngủ từ Store) */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { fontSize: fs(17) }]}>Sắp tới</Text>
              <TouchableOpacity onPress={() => onNavigateTab('medication')} activeOpacity={0.7}>
                <Text style={[styles.sectionActionText, { fontSize: fs(13) }]}>Xem tất cả ›</Text>
              </TouchableOpacity>
            </View>

            {nextUpcomingItem ? (
              <View style={styles.upcomingCard}>
                <View style={styles.upcomingIconCircle}>
                  <Feather
                    name={
                      nextUpcomingItem.kind === 'WATER'
                        ? 'droplet'
                        : nextUpcomingItem.kind === 'SLEEP'
                          ? 'moon'
                          : 'clock'
                    }
                    size={22}
                    color={
                      nextUpcomingItem.kind === 'WATER'
                        ? '#0284C7'
                        : nextUpcomingItem.kind === 'SLEEP'
                          ? '#4F46E5'
                          : colors.primary
                    }
                  />
                </View>

                <View style={styles.upcomingTextCol}>
                  <Text style={[styles.upcomingTime, { fontSize: fs(13) }]}>
                    {nextUpcomingItem.kicker}
                  </Text>
                  <Text style={[styles.upcomingMedName, { fontSize: fs(16) }]}>
                    {nextUpcomingItem.title}
                  </Text>
                  <Text style={[styles.upcomingMedDose, { fontSize: fs(12.5) }]}>
                    {nextUpcomingItem.subtitle}
                  </Text>

                  <TouchableOpacity
                    style={styles.upcomingConfirmBtn}
                    onPress={() => handleConfirmUpcomingItem(nextUpcomingItem)}
                    disabled={confirmingKey === nextUpcomingItem.key}
                    activeOpacity={0.8}
                  >
                    {confirmingKey === nextUpcomingItem.key ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.upcomingConfirmBtnText, { fontSize: fs(13) }]}>
                          {nextUpcomingItem.confirmLabel}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : totalMeds > 0 && takenCount === totalMeds ? (
              <View style={styles.allDoneUpcomingCard}>
                <View style={styles.allDoneIconCircle}>
                  <Feather name="check-circle" size={24} color={colors.successText} />
                </View>
                <View style={styles.allDoneTextCol}>
                  <Text style={[styles.allDoneTitle, { fontSize: fs(15) }]}>
                    Đã hoàn thành toàn bộ lịch hôm nay
                  </Text>
                  <Text style={[styles.allDoneSub, { fontSize: fs(12) }]}>
                    Cụ đã uống đủ {takenCount}/{totalMeds} cữ thuốc đúng giờ. Rất tuyệt vời ạ!
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyUpcomingCard}>
                <View style={styles.allDoneIconCircle}>
                  <Feather name="calendar" size={24} color={colors.primary} />
                </View>
                <View style={styles.allDoneTextCol}>
                  <Text style={[styles.allDoneTitle, { fontSize: fs(15) }]}>
                    Không có lịch nhắc cần xử lý
                  </Text>
                  <Text style={[styles.allDoneSub, { fontSize: fs(12) }]}>
                    Chúc cụ một ngày thật bình an và vui vẻ bên con cháu!
                  </Text>
                </View>
              </View>
            )}

            {/* Quick status preview for Water & Sleep synced from CareRoutineStore */}
            {todayRoutine && (
              <TouchableOpacity
                style={styles.routinePreviewRow}
                onPress={() => onNavigateTab('medication')}
                activeOpacity={0.8}
              >
                <View style={styles.routinePreviewItem}>
                  <View style={[styles.routineMiniIcon, { backgroundColor: '#EAF4FB' }]}>
                    <Feather name="droplet" size={15} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.routinePreviewLabel, { fontSize: fs(11.5) }]}>
                      Nước lọc hôm nay
                    </Text>
                    <Text style={[styles.routinePreviewValue, { fontSize: fs(13), color: '#0369A1' }]}>
                      {(() => {
                        const water = resolveWaterMetrics(todayRoutine);
                        return `${water.completedLitersLabel}/${water.targetLitersLabel} L (${water.completedCups}/${water.targetCups} ly)`;
                      })()}
                    </Text>
                    <Text style={[styles.routinePreviewSub, { fontSize: fs(11) }]} numberOfLines={1}>
                      {!todayRoutine.waterEnabled
                        ? 'Đang tắt nhắc'
                        : nextPendingWaterTime
                          ? `Nhắc tiếp: ${nextPendingWaterTime}`
                          : resolveWaterMetrics(todayRoutine).evaluationText}
                    </Text>
                  </View>
                </View>

                <View style={styles.routinePreviewDivider} />

                <View style={styles.routinePreviewItem}>
                  <View style={[styles.routineMiniIcon, { backgroundColor: '#EEF0FB' }]}>
                    <Feather name="moon" size={15} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.routinePreviewLabel, { fontSize: fs(11.5) }]}>
                      Giấc ngủ
                    </Text>
                    <Text style={[styles.routinePreviewValue, { fontSize: fs(13) }]}>
                      {todayRoutine.sleepStatus === 'COMPLETED' ? 'Đã đi ngủ' : `Ngủ ${todayRoutine.bedtimeTime}`}
                    </Text>
                    <Text style={[styles.routinePreviewSub, { fontSize: fs(11) }]} numberOfLines={1}>
                      Dậy {todayRoutine.wakeupTime} • {todayRoutine.sleepTargetHours}h
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* 6. Today's Tip Card (Eldora Soft Green Nature Card) */}
          <View style={styles.sectionWrap}>
            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Feather name="sun" size={20} color="#8F6624" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={[styles.tipKicker, { fontSize: fs(11) }]}>
                  LỜI KHUYÊN SỨC KHỎE TỪ MIMAMORI AI
                </Text>
                <Text style={[styles.tipBody, { fontSize: fs(13.5) }]}>
                  Một ly nước ấm vào buổi sáng sau khi thức dậy sẽ giúp cơ thể cụ thanh lọc tự nhiên, tăng tuần hoàn máu và tinh thần sảng khoái suốt ngày dài!
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 110,
  },
  topGreetingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greetingTextCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  greetingSub: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  greetingName: {
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  greetingQuestion: {
    color: colors.textSecondary,
  },
  seniorAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.subtle,
  },
  seniorAvatarImg: {
    width: '100%',
    height: '100%',
  },
  sosContainer: {
    marginBottom: 16,
  },
  dueAlertCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    ...shadows.card,
  },
  dueAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dueBellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dueBellBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  dueTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dueTimeText: {
    fontWeight: '800',
  },
  dueSubtitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    lineHeight: 23,
    marginBottom: 12,
  },
  dueExtraBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  dueExtraLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  dueExtraChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dueExtraChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dueExtraChipText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dueActionsRow: {
    gap: 10,
  },
  duePrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  duePrimaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duePrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dueMuteBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dueMuteBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  centerLoading: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
  sectionWrap: {
    marginBottom: 18,
  },
  dailyWellnessCard: {
    flexDirection: 'row',
    backgroundColor: '#F7EFE2',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EBDDC5',
    ...shadows.subtle,
  },
  wellnessLeftCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  wellnessBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  wellnessBadgeText: {
    fontWeight: '800',
    color: '#8F6624',
    letterSpacing: 0.5,
  },
  wellnessTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  wellnessDesc: {
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  wellnessBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  wellnessBtnDone: {
    backgroundColor: colors.successText,
  },
  wellnessBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1,
  },
  wellnessRightCol: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  smileFaceCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridSectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  gridCard: {
    width: '31.5%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
    flexShrink: 1,
  },
  gridCardSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    flexShrink: 1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionActionText: {
    color: colors.primary,
    fontWeight: '700',
  },
  upcomingCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  upcomingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upcomingTextCol: {
    flex: 1,
    minWidth: 0,
  },
  upcomingTime: {
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  upcomingMedName: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  upcomingMedDose: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  upcomingConfirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1,
  },
  allDoneUpcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  allDoneIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  allDoneTextCol: {
    flex: 1,
    minWidth: 0,
  },
  allDoneTitle: {
    fontWeight: '800',
    color: colors.successText,
    marginBottom: 2,
  },
  allDoneSub: {
    color: colors.successText,
    lineHeight: 18,
  },
  emptyUpcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  routinePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  routinePreviewItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  routineMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  routinePreviewLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  routinePreviewValue: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  routinePreviewSub: {
    color: colors.textSecondary,
  },
  routinePreviewDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderLight,
    marginHorizontal: 10,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF4EF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D7E5D9',
  },
  tipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipTextCol: {
    flex: 1,
    minWidth: 0,
  },
  tipKicker: {
    fontWeight: '800',
    color: '#8F6624',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tipBody: {
    color: colors.textPrimary,
    lineHeight: 20,
  },
});
