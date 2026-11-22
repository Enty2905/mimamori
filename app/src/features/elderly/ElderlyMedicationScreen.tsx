import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import { StatusBadge, BadgeVariant } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import {
  useCareRoutineStore,
  extractHHmm,
  resolveWaterMetrics,
  type MedicationLog,
} from '../../core/routines/useCareRoutineStore';
import {
  stopReminderSoundImmediately,
  muteCurrentDueReminders,
} from '../../core/routines/useElderlyReminderEngine';
import { WaterFillCircle } from '../../components/WaterFillCircle';

const PRESET_HOURS = ['07:00', '11:30', '18:00', '20:00'];

export interface ElderlyMedicationScreenProps {
  onAskMedicineAI?: () => void;
}

export const ElderlyMedicationScreen: React.FC<ElderlyMedicationScreenProps> = ({
  onAskMedicineAI,
}) => {
  const { fs } = useAccessibilityStore();

  const logs = useCareRoutineStore((s) => s.todayMeds);
  const todayRoutine = useCareRoutineStore((s) => s.todayRoutine);
  const storeLoading = useCareRoutineStore((s) => s.loading);
  const lastSyncedAt = useCareRoutineStore((s) => s.lastSyncedAt);
  const confirmingKey = useCareRoutineStore((s) => s.confirmingKey);
  const clockHHmm = useCareRoutineStore((s) => s.clockHHmm);
  const fetchElderlyTodayData = useCareRoutineStore((s) => s.fetchElderlyTodayData);
  const confirmMedicationLog = useCareRoutineStore((s) => s.confirmMedicationLog);
  const confirmRoutineLog = useCareRoutineStore((s) => s.confirmRoutineLog);
  const quickAddWater = useCareRoutineStore((s) => s.quickAddWater);

  const [historyLogs, setHistoryLogs] = useState<MedicationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [savingMed, setSavingMed] = useState(false);

  // New med form state
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [scheduledHour, setScheduledHour] = useState('08:00');
  const [instruction, setInstruction] = useState('Sau khi ăn 15 phút');

  const fetchSchedule = async (silent = false) => {
    try {
      await fetchElderlyTodayData(silent);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await apiClient<MedicationLog[]>('/api/medications/history');
      if (res.success && res.data) {
        setHistoryLogs(res.data);
      }
    } catch {
      // Handled
    }
  };

  useEffect(() => {
    fetchSchedule(lastSyncedAt !== null);
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'today') {
      fetchSchedule(true);
    } else {
      fetchHistory().then(() => setRefreshing(false));
    }
  };

  const handleConfirm = async (logId: number) => {
    stopReminderSoundImmediately();
    muteCurrentDueReminders('MEDICATION');
    try {
      const ok = await confirmMedicationLog(logId, 'Xác nhận uống thuốc từ danh sách thuốc');
      if (ok) {
        Alert.alert('Thành công', 'Đã ghi nhận cữ thuốc này đã uống!');
        fetchHistory();
      }
    } catch (err: any) {
      Alert.alert('Thông báo', err.message || 'Không thể xác nhận');
    }
  };

  const handleQuickWaterTap = async () => {
    stopReminderSoundImmediately();
    muteCurrentDueReminders('WATER');
    try {
      const dueWaterSlot = todayRoutine?.waterEnabled
        ? [...(todayRoutine.logs ?? [])].reverse().find((l) => {
            if (l.routineType !== 'WATER' || l.status !== 'PENDING') return false;
            const hhmm = extractHHmm(l.scheduledTime);
            return Boolean(hhmm && hhmm <= clockHHmm);
          })
        : undefined;

      if (dueWaterSlot) {
        await confirmRoutineLog(dueWaterSlot.id, 'Uống thêm 1 ly nước từ màn hình Sức khỏe & Thuốc');
      } else {
        await quickAddWater();
      }
    } catch (err: any) {
      Alert.alert('Thông báo', err?.message || 'Không thể ghi nhận ly nước');
    }
  };

  const handleDeleteMedication = (medicationId?: number, name?: string) => {
    if (!medicationId) return;
    Alert.alert(
      'Ngừng lịch thuốc',
      `Cụ có chắc chắn muốn ngừng lịch uống thuốc "${name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Ngừng lịch thuốc',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient(`/api/medications/${medicationId}`, { method: 'DELETE' });
              Alert.alert('Đã xóa', 'Lịch thuốc đã được ngừng.');
              fetchSchedule(true);
            } catch (e: any) {
              Alert.alert('Lỗi', e.message || 'Không thể xóa thuốc');
            }
          },
        },
      ]
    );
  };

  const handleCreateMedication = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều dùng của cụ.');
      return;
    }

    try {
      setSavingMed(true);
      const timeFormatted = scheduledHour.length === 5 ? `${scheduledHour}:00` : scheduledHour;
      const res = await apiClient('/api/medications', {
        method: 'POST',
        body: JSON.stringify({
          name: medName.trim(),
          dosage: dosage.trim(),
          instructions: instruction.trim(),
          startDate: new Date().toISOString().split('T')[0],
          reminderTimes: [timeFormatted],
        }),
      });

      if (res.success) {
        Alert.alert('Đã thêm thuốc', `Đã lên lịch nhắc cho thuốc "${medName}".`);
        setModalVisible(false);
        setMedName('');
        setDosage('');
        fetchSchedule(true);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu thuốc');
    } finally {
      setSavingMed(false);
    }
  };

  const getStatusProps = (status: MedicationLog['status']) => {
    switch (status) {
      case 'TAKEN':
        return { label: 'Đã uống', variant: 'success' as BadgeVariant };
      case 'MISSED':
        return { label: 'Đã trễ giờ', variant: 'danger' as BadgeVariant };
      case 'SKIPPED':
        return { label: 'Bỏ qua', variant: 'neutral' as BadgeVariant };
      default:
        return { label: 'Chờ uống', variant: 'warning' as BadgeVariant };
    }
  };

  const takenCount = logs.filter((l) => l.status === 'TAKEN').length;
  const adherencePercent = logs.length > 0 ? Math.round((takenCount / logs.length) * 100) : 100;
  const loading = storeLoading && lastSyncedAt === null;

  const nextWaterSlotTime = useMemo(() => {
    const slot = todayRoutine?.logs?.find(
      (l) => l.routineType === 'WATER' && l.status === 'PENDING'
    );
    return slot ? extractHHmm(slot.scheduledTime) : null;
  }, [todayRoutine]);

  const isAddingWater =
    confirmingKey === 'WATER_QUICK_ADD' ||
    Boolean(confirmingKey && confirmingKey.startsWith('WATER:'));

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.kickerText, { fontSize: fs(12) }]}>
            Sức khỏe & Lịch uống thuốc
          </Text>
          <Text style={[styles.screenTitle, { fontSize: fs(24) }]}>Sức khỏe & Thuốc</Text>
        </View>
        <TouchableOpacity
          style={styles.addMedHeaderBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Thêm thuốc mới"
        >
          <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={[styles.addMedHeaderBtnText, { fontSize: fs(13) }]}>Thêm thuốc</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Control Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'today' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('today')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.segmentText,
              { fontSize: fs(14) },
              activeTab === 'today' && styles.segmentTextActive,
            ]}
          >
            Hôm nay ({logs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'history' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.segmentText,
              { fontSize: fs(14) },
              activeTab === 'history' && styles.segmentTextActive,
            ]}
          >
            Lịch sử ({historyLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>Đang tải danh sách thuốc...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'today' ? (
            <>
              {/* Eldora Screen 3: Health Overview Card with Real Caregiver-Configured Routine Metrics */}
              {(() => {
                const water = resolveWaterMetrics(todayRoutine);
                return (
                  <View style={styles.healthOverviewCard}>
                    <View style={styles.overviewTopRow}>
                      <Text style={[styles.overviewCardTitle, { fontSize: fs(15) }]}>
                        Tổng quan sức khỏe hôm nay
                      </Text>
                      <View style={styles.hydrationBadgeSmall}>
                        <Text style={styles.hydrationBadgeSmallText}>
                          {water.status === 'TARGET_ACHIEVED'
                            ? 'Đủ nước ngày'
                            : water.status === 'MINIMUM_MET'
                              ? 'Đạt 1.3L+'
                              : todayRoutine?.sleepStatus === 'COMPLETED'
                                ? 'Đã đi ngủ'
                                : 'Đang theo dõi'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.overviewBodyRow}>
                      {/* Left: Ocean-Blue Rising Water-Level Circle */}
                      <View style={styles.scoreCol}>
                        <WaterFillCircle
                          percent={water.percent}
                          completedMl={water.completedMl}
                          targetMl={water.targetMl}
                          size={88}
                        />
                        <Text style={[styles.waterCircleLabel, { fontSize: fs(11) }]}>
                          Nước lọc hôm nay
                        </Text>
                      </View>

                      {/* Right: Real Caregiver-Configured Metrics synced with useCareRoutineStore */}
                      <View style={styles.metricsCol}>
                        {/* 1. Giấc ngủ */}
                        <View style={styles.metricItemRow}>
                          <View style={[styles.metricIconWrap, { backgroundColor: '#EEF0FB' }]}>
                            <Feather name="moon" size={14} color="#4F46E5" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.metricLabel, { fontSize: fs(11) }]}>Giấc ngủ</Text>
                            <Text style={[styles.metricVal, { fontSize: fs(12.5) }]}>
                              {todayRoutine
                                ? `Ngủ ${todayRoutine.bedtimeTime} • Dậy ${todayRoutine.wakeupTime} (${todayRoutine.sleepTargetHours}h)`
                                : 'Chưa có lịch ngủ'}
                            </Text>
                            <Text style={[styles.metricSubText, { fontSize: fs(11) }]}>
                              {!todayRoutine
                                ? 'Đang đồng bộ từ gia đình'
                                : !todayRoutine.sleepEnabled
                                  ? 'Đang tắt nhắc ngủ'
                                  : todayRoutine.sleepStatus === 'COMPLETED'
                                    ? 'Đã đi ngủ'
                                    : 'Chờ đến giờ ngủ'}
                              {todayRoutine?.lastNightSleepQuality
                                ? ` • Ngủ qua: ${todayRoutine.lastNightSleepQuality}`
                                : ''}
                            </Text>
                          </View>
                        </View>

                        {/* 2. Nước uống */}
                        <View style={styles.metricItemRow}>
                          <View style={[styles.metricIconWrap, { backgroundColor: '#E0F2FE' }]}>
                            <Feather name="droplet" size={14} color="#0284C7" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.metricLabel, { fontSize: fs(11) }]}>
                              Nước lọc ({water.cupMl}ml/ly)
                            </Text>
                            <Text style={[styles.metricVal, { fontSize: fs(12.5), color: '#0369A1' }]}>
                              {water.completedLitersLabel} / {water.targetLitersLabel} L ({water.completedCups}/{water.targetCups} ly)
                            </Text>
                            <Text style={[styles.metricSubText, { fontSize: fs(11) }]}>
                              {!todayRoutine?.waterEnabled
                                ? 'Đang tắt nhắc nước'
                                : nextWaterSlotTime
                                  ? `Nhắc tiếp: ${nextWaterSlotTime} • ${water.evaluationText}`
                                  : water.evaluationText}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.quickWaterPill}
                            onPress={handleQuickWaterTap}
                            disabled={isAddingWater}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Tôi đã uống thêm 1 ly nước"
                          >
                            {isAddingWater ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={[styles.quickWaterPillText, { fontSize: fs(11.5) }]}>
                                +1 ly
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* 3. Lịch thuốc */}
                        <View style={styles.metricItemRow}>
                          <View style={[styles.metricIconWrap, { backgroundColor: colors.primaryLight }]}>
                            <MaterialCommunityIcons name="pill" size={14} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.metricLabel, { fontSize: fs(11) }]}>Lịch thuốc</Text>
                            <Text style={[styles.metricVal, { fontSize: fs(12.5) }]}>
                              {takenCount} / {logs.length} cữ ({adherencePercent}%)
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {onAskMedicineAI && (
                <TouchableOpacity
                  style={styles.askMedicineAiCard}
                  onPress={onAskMedicineAI}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Chụp ảnh thuốc hỏi trợ lý AI"
                >
                  <View style={styles.askMedicineAiIconWrap}>
                    <Feather name="camera" size={20} color={colors.accentDark} />
                  </View>
                  <View style={styles.askMedicineAiTextCol}>
                    <Text style={[styles.askMedicineAiTitle, { fontSize: fs(14.5) }]}>
                      Chụp ảnh thuốc hỏi trợ lý AI
                    </Text>
                    <Text style={[styles.askMedicineAiSub, { fontSize: fs(12.5) }]}>
                      Đọc tên thuốc tiếng Anh, công dụng & cách dùng
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.accentDark} />
                </TouchableOpacity>
              )}

              {/* Section Title */}
              <View style={styles.medSectionHeaderRow}>
                <Text style={[styles.medSectionTitle, { fontSize: fs(17) }]}>
                  Lịch uống thuốc hôm nay
                </Text>
                <Text style={[styles.medAdherenceSummary, { fontSize: fs(13) }]}>
                  Đã uống {takenCount}/{logs.length} cữ
                </Text>
              </View>

              {logs.length === 0 ? (
                <EmptyState
                  vectorIcon="calendar"
                  title="Hôm nay chưa có lịch thuốc"
                  description="Cụ hoặc người thân có thể nhấn nút bên dưới để thêm các loại thuốc cần uống hàng ngày."
                  actionText="+ Thêm lịch uống thuốc mới"
                  onAction={() => setModalVisible(true)}
                />
              ) : (
                <View style={styles.timelineList}>
                  {logs.map((item, index) => {
                    const statusProps = getStatusProps(item.status);
                    const isTaken = item.status === 'TAKEN';
                    const timeDisplay = item.scheduledTime
                      ? item.scheduledTime.slice(11, 16) || item.scheduledTime.slice(0, 5)
                      : '08:00';

                    return (
                      <View key={item.id} style={styles.timelineItemRow}>
                        {/* Timeline indicator column */}
                        <View style={styles.timelineCol}>
                          <View
                            style={[
                              styles.timelineDot,
                              isTaken ? styles.timelineDotDone : styles.timelineDotPending,
                            ]}
                          >
                            {isTaken ? (
                              <Feather name="check" size={14} color="#FFFFFF" />
                            ) : (
                              <Text style={[styles.timelineDotText, { fontSize: fs(12) }]}>
                                {index + 1}
                              </Text>
                            )}
                          </View>
                          {index < logs.length - 1 && <View style={styles.timelineLine} />}
                        </View>

                        {/* Medication Card */}
                        <View style={styles.medCard}>
                          <View style={styles.cardHeaderRow}>
                            <View style={styles.timeBadgePill}>
                              <Feather name="clock" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                              <Text style={[styles.timeBadgeText, { fontSize: fs(13) }]}>
                                {timeDisplay}
                              </Text>
                            </View>
                            <View style={styles.headerRightActions}>
                              <StatusBadge label={statusProps.label} variant={statusProps.variant} />
                              <TouchableOpacity
                                style={styles.trashHeaderBtn}
                                onPress={() => handleDeleteMedication(item.medicationId, item.medicationName)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.6}
                                accessibilityLabel={`Ngừng thuốc ${item.medicationName}`}
                              >
                                <Feather name="trash-2" size={15} color={colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          <Text style={[styles.medCardTitle, { fontSize: fs(17) }]}>
                            {item.medicationName}
                          </Text>
                          <Text style={[styles.medCardDose, { fontSize: fs(13.5) }]}>
                            Liều dùng: {item.dosage}
                          </Text>

                          {item.instruction ? (
                            <View style={styles.instructionBox}>
                              <Feather name="info" size={13} color={colors.textSecondary} style={{ marginRight: 5 }} />
                              <Text style={[styles.instructionText, { fontSize: fs(12) }]}>
                                {item.instruction}
                              </Text>
                            </View>
                          ) : null}

                          {/* Redesigned footer: Clean full-width action + clear secondary action */}
                          <View style={styles.cardFooterArea}>
                            {!isTaken ? (
                              <TouchableOpacity
                                style={styles.confirmFullBtn}
                                onPress={() => handleConfirm(item.id)}
                                disabled={confirmingKey === `MEDICATION:${item.id}`}
                                activeOpacity={0.8}
                              >
                                {confirmingKey === `MEDICATION:${item.id}` ? (
                                  <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                  <View style={styles.btnInnerRow}>
                                    <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={[styles.confirmFullText, { fontSize: fs(14) }]}>
                                      Xác nhận đã uống cữ này
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.takenFullPill}>
                                <Feather name="check-circle" size={16} color={colors.successText} style={{ marginRight: 6 }} />
                                <Text style={[styles.takenFullText, { fontSize: fs(13) }]}>
                                  Đã hoàn thành cữ thuốc này
                                </Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.deleteLinkRow}
                              onPress={() => handleDeleteMedication(item.medicationId, item.medicationName)}
                              activeOpacity={0.6}
                            >
                              <Feather name="trash-2" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                              <Text style={[styles.deleteLinkText, { fontSize: fs(12) }]}>
                                Ngừng lịch uống thuốc này
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            // History Tab View
            historyLogs.length === 0 ? (
              <EmptyState
                vectorIcon="clock"
                title="Chưa có lịch sử"
                description="Các cữ thuốc đã uống hoặc đã qua sẽ được lưu trữ tự động tại đây."
              />
            ) : (
              <View style={styles.historyList}>
                {historyLogs.map((item) => {
                  const statusProps = getStatusProps(item.status);
                  const dateStr = item.scheduledTime ? item.scheduledTime.slice(0, 10) : '';
                  const timeStr = item.scheduledTime ? item.scheduledTime.slice(11, 16) : '';
                  return (
                    <View key={item.id} style={styles.historyItemCard}>
                      <View style={styles.historyTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="calendar" size={13} color={colors.textSecondary} style={{ marginRight: 5 }} />
                          <Text style={[styles.historyDate, { fontSize: fs(13) }]}>
                            {dateStr} • {timeStr}
                          </Text>
                        </View>
                        <StatusBadge label={statusProps.label} variant={statusProps.variant} size="small" />
                      </View>
                      <Text style={[styles.historyMedName, { fontSize: fs(16) }]}>
                        {item.medicationName}
                      </Text>
                      <Text style={[styles.historyDose, { fontSize: fs(13) }]}>
                        Liều dùng: {item.dosage}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal Add Medication - Clean Form Layout */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.modalTitle, { fontSize: fs(20) }]}>Thêm đơn thuốc mới</Text>
                <Text style={[styles.modalSubtitle, { fontSize: fs(13) }]}>
                  Nhập thông tin thuốc cần uống hàng ngày
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.inputLabel, { fontSize: fs(13.5) }]}>Tên thuốc *</Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons name="pill" size={18} color={colors.primary} style={styles.inputBoxIcon} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(15) }]}
                  placeholder="Ví dụ: Amlodipine, Hoạt huyết..."
                  value={medName}
                  onChangeText={setMedName}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={[styles.inputLabel, { fontSize: fs(13.5) }]}>Liều dùng *</Text>
              <View style={styles.inputBox}>
                <Feather name="check-square" size={16} color={colors.primary} style={styles.inputBoxIcon} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(15) }]}
                  placeholder="Ví dụ: 1 viên, nửa viên, 2 thìa..."
                  value={dosage}
                  onChangeText={setDosage}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={[styles.inputLabel, { fontSize: fs(13.5) }]}>
                Giờ uống thuốc *
              </Text>
              <View style={styles.inputBox}>
                <Feather name="clock" size={16} color={colors.primary} style={styles.inputBoxIcon} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(15) }]}
                  placeholder="08:00"
                  value={scheduledHour}
                  onChangeText={setScheduledHour}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Preset hour pills */}
              <View style={styles.presetPillRow}>
                {PRESET_HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.presetPill, scheduledHour === h && styles.presetPillActive]}
                    onPress={() => setScheduledHour(h)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetPillText, scheduledHour === h && styles.presetPillTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { fontSize: fs(13.5) }]}>Cách dùng / Lưu ý</Text>
              <View style={styles.inputBox}>
                <Feather name="file-text" size={16} color={colors.primary} style={styles.inputBoxIcon} />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(15) }]}
                  placeholder="Ví dụ: Sau khi ăn 15 phút với nước ấm"
                  value={instruction}
                  onChangeText={setInstruction}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalVisible(false)}
                  disabled={savingMed}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { fontSize: fs(14) }]}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleCreateMedication}
                  disabled={savingMed}
                  activeOpacity={0.8}
                >
                  {savingMed ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={[styles.modalSaveText, { fontSize: fs(15) }]}>
                      Lưu lịch thuốc
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  kickerText: {
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  screenTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  addMedHeaderBtn: {
    flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
  },
  addMedHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollList: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  healthOverviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  overviewTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  overviewCardTitle: {
    flex: 1,
    flexShrink: 1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  hydrationBadgeSmall: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  hydrationBadgeSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
  },
  waterCircleLabel: {
    color: '#0369A1',
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 96,
    marginTop: 6,
  },
  statusBadgeSmall: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  overviewBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  circularScoreBox: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primaryLight,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scoreNumber: {
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
  },
  scoreLabel: {
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 84,
  },
  metricsCol: {
    flex: 1,
    gap: 8,
  },
  metricItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricLabel: {
    color: colors.textSecondary,
    lineHeight: 14,
  },
  metricVal: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricSubText: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  quickWaterPill: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 58,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  quickWaterPillText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  medSectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  medSectionTitle: {
    flexShrink: 1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  medAdherenceSummary: {
    color: colors.primary,
    fontWeight: '700',
  },
  timelineList: {
    marginBottom: 10,
  },
  timelineItemRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineCol: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: colors.primary,
  },
  timelineDotPending: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timelineDotText: {
    fontWeight: '800',
    color: colors.textSecondary,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  medCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  timeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontWeight: '700',
    color: colors.primary,
  },
  medCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  medCardDose: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    padding: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  instructionText: {
    color: colors.textPrimary,
    flex: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trashHeaderBtn: {
    padding: 4,
  },
  cardFooterArea: {
    marginTop: 10,
  },
  confirmFullBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmFullText: {
    color: '#FFFFFF',
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  takenFullPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  takenFullText: {
    color: colors.successText,
    fontWeight: '700',
    flexShrink: 1,
  },
  deleteLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  deleteLinkText: {
    color: colors.textMuted,
    fontWeight: '600',
    flexShrink: 1,
  },
  historyList: {
    gap: 12,
  },
  historyItemCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  historyTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  historyDate: {
    color: colors.textSecondary,
  },
  historyMedName: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  historyDose: {
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 18,
    maxHeight: '90%',
    ...shadows.elevated,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputBoxIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  presetPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  presetPill: {
    backgroundColor: colors.surfaceWarm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  presetPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  askMedicineAiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentLight,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    ...shadows.subtle,
  },
  askMedicineAiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askMedicineAiTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  askMedicineAiTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  askMedicineAiSub: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
});