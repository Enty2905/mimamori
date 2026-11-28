import {useOriginalLabels,signalLabel} from '../../core/localization/original';
import {useColors} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React from 'react';
import {
  View,
    StyleSheet,
  ScrollView,
    ActivityIndicator,
  RefreshControl,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../../core/theme/colors';
import { useSession } from '../../core/auth/useSession';
import {careApi} from '../../core/api/careApi';
import {useQuery} from '@tanstack/react-query';
import {useSelectedElderly} from './queries';
import {doseTime} from '../../core/config/time';
import {Notice,Button} from '../../components/CareUI';

interface Props {
  onNavigateTab: (tab: 'dashboard' | 'alerts' | 'family' | 'medication') => void;
}

export const CaregiverDashboardScreen: React.FC<Props> = ({ onNavigateTab }) => {
  const {width}=useWindowDimensions();
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { user } = useSession();
  const selected=useSelectedElderly();
  const familyMembers=selected.family.data?.filter(item=>item.status==='ACCEPTED') ?? [];
  const selectedElderlyId=selected.id;
  const setSelectedElderlyId=selected.select;
  const overview=useQuery({queryKey:['overview',user?.id,selectedElderlyId],enabled:!!selectedElderlyId,queryFn:()=>careApi.overview(selectedElderlyId)});
  const data=overview.data;
  const loading=!!selectedElderlyId && overview.isPending;
  const refreshing=overview.isRefetching || selected.family.isRefetching;
  const onRefresh=()=>{void selected.family.refetch();if(selectedElderlyId)void overview.refetch();};
  const getStatusVisuals = (status?: string) => {
    switch (status) {
      case 'NORMAL':
        return { label: 'BÌNH THƯỜNG', color: colors.successText, bg: colors.success, iconName: 'check-circle' as const };
      case 'REMINDER_REQUIRED':
        return { label: 'CẦN NHẮC NHỞ', color: colors.background === baseColors.background ? '#995C17' : colors.textPrimary, bg: colors.background === baseColors.background ? '#FEF6EC' : colors.surfaceWarm, iconName: 'bell' as const };
      case 'NEEDS_ATTENTION':
        return { label: 'CẦN LƯU Ý', color: colors.background === baseColors.background ? '#C2410C' : colors.textPrimary, bg: colors.background === baseColors.background ? '#FFEDD5' : colors.surfaceWarm, iconName: 'alert-triangle' as const };
      case 'CRITICAL':
        return { label: 'CẢNH BÁO KHẨN', color: colors.dangerText, bg: colors.danger, iconName: 'alert-octagon' as const };
      default:
        return { label: 'CHƯA ĐỦ DỮ LIỆU', color: colors.textSecondary, bg: colors.surfaceWarm, iconName: 'help-circle' as const };
    }
  };

  if(overview.isError || selected.family.isError) return <View style={styles.container}><Notice tone="danger" text={tr('Không thể tải dữ liệu người thân.')} /><Button title={tr('Thử lại')} onPress={onRefresh} /></View>;
  const statusVisual = getStatusVisuals(data?.careStatus);
  const adherencePercent = data?.medicationAdherence == null ? null : Math.round(data.medicationAdherence * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Caregiver Welcome Bar */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 210 }}>
          <Image
            source={require('../../../assets/images/mimamori-leaf-icon.png')}
            style={{ width: 34, minHeight: 56, marginRight: 10 }}
            resizeMode="contain"
          />
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={styles.caregiverRole}>{tr("GIÁM SÁT TỪ XA • MIMAMORI")}</Text>
            <Text style={styles.caregiverName}>{tr("Chào ")}{user?.fullName || tr("Người chăm sóc")}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshPill} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={13} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.refreshText}>{tr("Cập nhật")}</Text>
        </TouchableOpacity>
      </View>

      {/* Linked Elderly Selector Pills (Synchronized with Family Relationships) */}
      {familyMembers.length > 0 && (
        <View style={styles.selectorWrap}>
          <Text style={styles.selectorLabel}>{tr("CHỌN NGƯỜI THÂN ĐANG THEO DÕI:")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
            {familyMembers.map((fm) => {
              const isSelected = selectedElderlyId === fm.member.id;
              return (
                <TouchableOpacity
                  key={fm.member.id}
                  style={[styles.memberPill, {maxWidth: width-32}, isSelected && styles.memberPillActive]}
                  onPress={() => setSelectedElderlyId(fm.member.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.pillAvatar, isSelected && styles.pillAvatarActive]}>
                    <Feather name="user" size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={{flexShrink:1,minWidth:0}}>
                    <Text style={[styles.pillName, isSelected && styles.pillNameActive]}>
                      {fm.member.fullName}
                    </Text>
                    <Text style={[styles.pillRelation, isSelected && styles.pillRelationActive]}>
                      {fm.relationshipType || tr("Người thân")}{tr(" (@")}{fm.member.username}{tr(")")}</Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={14} color={colors.primary} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {(overview.isError || selected.family.isError) && <><Notice tone="danger" text={tr("Không thể tải dữ liệu người thân.")} /><Button title={tr("Thử lại")} onPress={onRefresh} /></>}
      {!selectedElderlyId && <Notice text={tr("Chưa có người thân đã đồng ý liên kết. Vui lòng kiểm tra mục Gia đình.")} />}
      {/* Monitored Elderly Banner */}
      <View style={styles.elderlyCard}>
        <View style={styles.elderlyAvatar}>
          <Feather name="user" size={24} color={colors.primary} />
        </View>
        <View style={styles.elderlyInfoCol}>
          <Text style={styles.elderlyName}>{data?.elderly?.fullName || tr("Người cao tuổi")}</Text>
          <Text style={styles.elderlyRelation}>{tr("Tài khoản: @")}{data?.elderly?.username || '—'}
            {data?.elderly?.phone ? ` • SĐT: ${data.elderly.phone}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusVisual.bg }]}>
          <Feather name={statusVisual.iconName} size={13} color={statusVisual.color} style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: statusVisual.color }]}>
            {tr(statusVisual.label)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{tr("Đang đồng bộ dữ liệu người cao tuổi...")}</Text>
        </View>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <View style={styles.metricsRow}>
            {/* Adherence Rate */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
                <Text style={styles.metricLabel}>{tr("Uống thuốc")}</Text>
              </View>
              <Text style={[styles.metricValue, { color: (adherencePercent ?? 0) >= 80 ? colors.successText : '#C2410C' }]}>
                {adherencePercent === null ? '—' : `${adherencePercent ?? 0}%`}
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${adherencePercent === null ? '—' : `${adherencePercent ?? 0}%`}`,
                      backgroundColor: (adherencePercent ?? 0) >= 80 ? colors.primary : '#F97316',
                    },
                  ]}
                />
              </View>
              <Text style={styles.metricSub}>{tr("Hôm nay: ")}{data?.todayMedications?.filter((m) => m.status === 'TAKEN').length || 0}{tr("/")}{data?.todayMedications?.length || 0}{tr(" cữ đã uống")}</Text>
            </View>

            {/* Check-in Status */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <Feather name="check-circle" size={16} color={data?.todayCheckIn ? colors.primary : '#D97706'} />
                <Text style={styles.metricLabel}>{tr("Điểm danh")}</Text>
              </View>
              {data?.todayCheckIn ? (
                <>
                  <Text style={[styles.metricValue, { color: colors.successText }]}>{tr("Đã xong")}</Text>
                  <Text style={styles.checkInDetailText} numberOfLines={1}>{tr("Tâm trạng: ")}{data.todayCheckIn.mood}
                  </Text>
                  <Text style={styles.checkInDetailText} numberOfLines={1}>{tr("Thể trạng: ")}{data.todayCheckIn.physicalHealth}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.metricValue, { color: colors.background === baseColors.background ? '#D97706' : colors.textPrimary }]}>{tr("Chưa gửi")}</Text>
                  <Text style={styles.metricSub}>{tr("Cụ chưa gửi thông tin thăm hỏi hôm nay")}</Text>
                </>
              )}
            </View>
          </View>

          {/* Today's Detailed Medication Schedule (Synchronized) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="pill" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>{tr("Lịch thuốc của cụ hôm nay")}</Text>
              </View>
              <TouchableOpacity onPress={() => onNavigateTab('medication')}>
                <Text style={styles.seeAllText}>{tr("Quản lý ›")}</Text>
              </TouchableOpacity>
            </View>

            {(!data?.todayMedications || data.todayMedications.length === 0) ? (
              <View style={styles.emptyInlineBox}>
                <Feather name="calendar" size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyInlineText}>{tr("Hôm nay cụ chưa có lịch uống thuốc nào.")}</Text>
              </View>
            ) : (
              data.todayMedications.map((med) => {
                const isTaken = med.status === 'TAKEN';
                return (
                  <View key={med.id} style={styles.medRowItem}>
                    <View style={[styles.medStatusDot, { backgroundColor: isTaken ? colors.primary : colors.border }]}>
                      <Feather name={isTaken ? 'check' : 'clock'} size={12} color={isTaken ? '#FFFFFF' : colors.textSecondary} />
                    </View>
                    <View style={styles.medInfoCol}>
                      <Text style={styles.medNameText}>{med.medicationName}</Text>
                      <Text style={styles.medDoseText}>{tr("Liều: ")}{med.dosage}{tr(" • Giờ: ")}{med.scheduledTime ? doseTime(med.scheduledAt, med.timeZone) : '08:00'}
                      </Text>
                    </View>
                    <View style={[styles.medBadge, { backgroundColor: isTaken ? colors.success : colors.surfaceWarm }]}>
                      <Text style={[styles.medBadgeText, { color: isTaken ? colors.successText : colors.textSecondary }]}>
                        {isTaken ? tr("Đã uống") : med.status === 'MISSED' ? tr("Trễ giờ") : tr("Chờ uống")}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Active Care Alerts Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="alert-triangle" size={18} color={colors.dangerText} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>{tr("Cảnh báo cần chú ý")}</Text>
              </View>
              <TouchableOpacity onPress={() => onNavigateTab('alerts')}>
                <Text style={styles.seeAllText}>{tr("Xem tất cả (")}{data?.activeAlerts?.length || 0}{tr(") ›")}</Text>
              </TouchableOpacity>
            </View>

            {(!data?.activeAlerts || data.activeAlerts.length === 0) ? (
              <View style={styles.emptyAlertsBox}>
                <View style={styles.shieldIconWrap}>
                  <Feather name="shield" size={26} color={colors.successText} />
                </View>
                <Text style={styles.emptyAlertsText}>{tr("Không có cảnh báo khẩn cấp nào")}</Text>
                <Text style={styles.emptyAlertsSub}>{tr("Người cao tuổi đang sinh hoạt trong điều kiện ổn định.")}</Text>
              </View>
            ) : (
              data.activeAlerts.slice(0, 2).map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <Feather name="alert-circle" size={20} color={colors.dangerText} style={styles.alertItemIcon} />
                  <View style={styles.alertItemCol}>
                    <Text style={styles.alertItemTitle}>{alert.title}</Text>
                    <Text style={styles.alertItemDesc}>{alert.description}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* AI Care Agent Daily Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeaderRow}>
              <View style={styles.summaryIconWrap}>
                <Feather name="cpu" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.summaryTitle}>{tr("Báo cáo thông minh từ Care Agent")}</Text>
                <Text style={styles.summarySub}>{tr("Tổng hợp tự động hoạt động và sức khỏe")}</Text>
              </View>
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryText}>
                <Text style={{ fontWeight: '700' }}>{tr("Điểm danh: ")}</Text>
                {data?.recentSummary?.checkinSummary || (data?.todayCheckIn ? `Hôm nay tâm trạng ${signalLabel(data.todayCheckIn.mood)}, thể trạng ${signalLabel(data.todayCheckIn.physicalHealth)}, giấc ngủ ${signalLabel(data.todayCheckIn.sleepQuality)}.` : tr("Chưa hoàn thành điểm danh hôm nay."))}
              </Text>
              <Text style={[styles.summaryText, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '700' }}>{tr("Ghi chú AI: ")}</Text>
                {data?.recentSummary?.aiHealthNote || tr("Gia đình hãy nhắc cụ uống đủ nước ấm và giữ ấm cơ thể trong ngày hôm nay.")}
              </Text>
            </View>
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  topHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  caregiverRole: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  caregiverName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  selectorWrap: {
    marginBottom: 14,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  selectorRow: {
    gap: 8,
    paddingBottom: 4,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  memberPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  pillAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pillAvatarActive: {
    backgroundColor: colors.surface,
  },
  pillName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pillNameActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  pillRelation: {
    fontSize: 11,
    color: colors.textMuted,
  },
  pillRelationActive: {
    color: colors.primaryDark,
  },
  elderlyCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  elderlyAvatar: {
    width: 48,
    minHeight: 56,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  elderlyInfoCol: {
    flex: 1,
    flexBasis: 180,
    minWidth: 160,
  },
  elderlyName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  elderlyRelation: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  checkInDetailText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyInlineBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyInlineText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  medRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  medStatusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  medInfoCol: {
    flex: 1,
  },
  medNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  medDoseText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  medBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyAlertsBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  shieldIconWrap: {
    width: 48,
    minHeight: 56,
    borderRadius: 24,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyAlertsText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.successText,
  },
  emptyAlertsSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  alertItem: {
    flexDirection: 'row',
    backgroundColor: colors.danger,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  alertItemIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  alertItemCol: {
    flex: 1,
  },
  alertItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerText,
  },
  alertItemDesc: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,

  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryIconWrap: {
    width: 36,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summarySub: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  summaryContent: {
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    borderRadius: 14,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textPrimary,

  },
});
