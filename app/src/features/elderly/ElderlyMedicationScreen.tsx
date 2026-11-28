import {useOriginalLabels,adherenceLabel} from '../../core/localization/original';
import {useColors} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React, { useState } from 'react';
import {
  View,
    StyleSheet,
  ScrollView,
    ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { MedicationForm } from '../medication/MedicationForm';
import { Dose } from '../../core/api/contracts';
import { useDoseList } from '../medication/queries';
import { useSelectedElderly } from '../caregiver/queries';
import { useSession } from '../../core/auth/useSession';
import { MedicationManagement } from '../medication/MedicationManagement';
import { DoseActions } from '../medication/DoseActions';
import { doseTime } from '../../core/config/time';
import { Notice, Button } from '../../components/CareUI';
import { StatusBadge, BadgeVariant } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';

type MedicationLog = Dose;


export const ElderlyMedicationScreen: React.FC = () => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { fs } = useAccessibilityStore();
  const session = useSession();
  const selected = useSelectedElderly();
  const targetId = session.role === 'CAREGIVER' ? selected.id : session.userId ?? undefined;
  const today = useDoseList('today', targetId);
  const history = useDoseList('history', targetId);
  const logs = today.data?.items ?? [];
  const historyLogs = history.data?.items ?? [];
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const currentQuery = activeTab === 'today' ? today : history;
  const loading = currentQuery.isPending;
  const refreshing = currentQuery.isRefetching;
  const [modalVisible, setModalVisible] = useState(false);
  const onRefresh = () => {void currentQuery.refetch();};

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
  const adherencePercent = logs.length > 0 ? Math.round((takenCount / logs.length) * 100) : null;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.kickerText, { fontSize: fs(12) }]}>{tr("Sức khỏe & Lịch uống thuốc")}</Text>
          <Text style={[styles.screenTitle, { fontSize: fs(24) }]}>{tr("Sức khỏe & Thuốc")}</Text>
        </View>
        <TouchableOpacity
          style={styles.addMedHeaderBtn}
          disabled={!targetId}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={tr("Thêm thuốc mới")}
        >
          <Feather name="plus" size={16} color={colors.textInverse} style={{ marginRight: 4 }} />
          <Text style={[styles.addMedHeaderBtnText, { fontSize: fs(13) }]}>{tr("Thêm thuốc")}</Text>
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
          >{tr("Hôm nay (")}{logs.length}{tr(")")}</Text>
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
          >{tr("Lịch sử (")}{historyLogs.length}{tr(")")}</Text>
        </TouchableOpacity>
      </View>

      {session.role === 'CAREGIVER' && !targetId && <Notice tone="warning" text={tr("Chọn hoặc liên kết người thân đã đồng ý để quản lý thuốc.")} />}
      {currentQuery.isError && <View style={{padding: 20}}><Notice tone="danger" text={tr("Không thể tải lịch thuốc. Vui lòng thử lại.")} /><Button title={tr("Thử lại")} onPress={onRefresh} /></View>}
      {currentQuery.data?.stale && <Notice tone="warning" text={tr("Đang xem lịch đã lưu. Chưa đồng bộ với máy chủ.")} />}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>{tr("Đang tải danh sách thuốc...")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {currentQuery.isError ? null : activeTab === 'today' ? (
            <>
              <View style={styles.healthOverviewCard}>
                <Text style={[styles.overviewCardTitle, {fontSize: fs(20)}]}>{tr("Uống thuốc hôm nay")}</Text>
                <Text style={{fontSize: fs(20), color: colors.textPrimary}}>{adherencePercent === null ? tr("Chưa có lịch để tính tỷ lệ") : adherenceLabel(takenCount,logs.length,adherencePercent)}</Text>
              </View>

              {/* Section Title */}
              <View style={styles.medSectionHeaderRow}>
                <Text style={[styles.medSectionTitle, { fontSize: fs(20) }]}>{tr("Lịch uống thuốc hôm nay")}</Text>
                <Text style={[styles.medAdherenceSummary, { fontSize: fs(13) }]}>{tr("Đã uống ")}{takenCount}{tr("/")}{logs.length}{tr(" cữ")}</Text>
              </View>

              {logs.length === 0 ? (
                <EmptyState
                  vectorIcon="calendar"
                  title={tr("Hôm nay chưa có lịch thuốc")}
                  description={tr("Cụ hoặc người thân có thể nhấn nút bên dưới để thêm các loại thuốc cần uống hàng ngày.")}
                  actionText={tr("+ Thêm lịch uống thuốc mới")}
                  onAction={() => setModalVisible(true)}
                />
              ) : (
                <View style={styles.timelineList}>
                  {logs.map((item, index) => {
                    const statusProps = getStatusProps(item.status);
                    const isTaken = item.status === 'TAKEN';
                    const timeDisplay = doseTime(item.scheduledAt, item.timeZone);

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
                              <Feather name="check" size={14} color={colors.textInverse} />
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
                              <StatusBadge label={tr(statusProps.label)} variant={statusProps.variant} />
                            </View>
                          </View>

                          <Text style={[styles.medCardTitle, { fontSize: fs(20) }]}>
                            {item.medicationName}
                          </Text>
                          <Text style={[styles.medCardDose, { fontSize: fs(13.5) }]}>{tr("Liều dùng: ")}{item.dosage}
                          </Text>

                          {item.instructions ? (
                            <View style={styles.instructionBox}>
                              <Feather name="info" size={13} color={colors.textSecondary} style={{ marginRight: 5 }} />
                              <Text style={[styles.instructionText, { fontSize: fs(12) }]}>
                                {item.instructions}
                              </Text>
                            </View>
                          ) : null}

                          {/* Redesigned footer: Clean full-width action + clear secondary action */}
                          <View style={styles.cardFooterArea}>
                            <DoseActions dose={item} />
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
                title={tr("Chưa có lịch sử")}
                description={tr("Các cữ thuốc đã uống hoặc đã qua sẽ được lưu trữ tự động tại đây.")}
              />
            ) : (
              <View style={styles.historyList}>
                {historyLogs.map((item) => {
                  const statusProps = getStatusProps(item.status);
                  const dateStr = item.scheduledTime ? item.scheduledTime.slice(0, 10) : '';
                  const timeStr = doseTime(item.scheduledAt, item.timeZone);
                  return (
                    <View key={item.id} style={styles.historyItemCard}>
                      <View style={styles.historyTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="calendar" size={13} color={colors.textSecondary} style={{ marginRight: 5 }} />
                          <Text style={[styles.historyDate, { fontSize: fs(13) }]}>
                            {dateStr}{tr(" • ")}{timeStr}
                          </Text>
                        </View>
                        <StatusBadge label={tr(statusProps.label)} variant={statusProps.variant} size="small" />
                      </View>
                      <Text style={[styles.historyMedName, { fontSize: fs(20) }]}>
                        {item.medicationName}
                      </Text>
                      <Text style={[styles.historyDose, { fontSize: fs(13) }]}>{tr("Liều dùng: ")}{item.dosage}
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

      <MedicationManagement elderlyId={targetId} />

      <Modal visible={modalVisible} onRequestClose={() => setModalVisible(false)} animationType="slide">
        <MedicationForm elderlyId={targetId} onClose={() => setModalVisible(false)} />
      </Modal>
    </View>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
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
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
  },
  addMedHeaderBtnText: {
    color: colors.textInverse,
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
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollList: {
    paddingHorizontal: 18,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  overviewCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
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

  },
  metricVal: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  medSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medSectionTitle: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmFullText: {
    color: colors.textInverse,
    fontWeight: '800',
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    minHeight: 56,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontWeight: '800',
    color: colors.textInverse,
  },
});
