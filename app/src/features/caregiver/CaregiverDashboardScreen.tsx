import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { apiClient } from '../../core/api/client';

interface FamilyMember {
  relationshipId: number;
  member: {
    id: number;
    fullName: string;
    username: string;
    role: string;
    phoneNumber?: string;
  };
  relationshipType: string;
  status: string;
}

interface DashboardOverview {
  elderly: {
    id: number;
    fullName: string;
    username: string;
    phoneNumber?: string;
  };
  careStatus: 'NORMAL' | 'REMINDER_REQUIRED' | 'NEEDS_ATTENTION' | 'CRITICAL';
  medicationAdherence: number;
  todayCheckIn?: {
    id: number;
    mood: string;
    physicalHealth: string;
    sleepQuality: string;
    appetite: string;
    notes?: string;
    aiAnalysis?: string;
  };
  todayMedications: Array<{
    id: number;
    medicationName: string;
    dosage: string;
    scheduledTime: string;
    status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED';
  }>;
  activeAlerts: Array<{
    id: number;
    alertType: string;
    title: string;
    description: string;
    severity: string;
    createdAt: string;
  }>;
  recentSummary?: {
    summaryDate: string;
    checkinSummary: string;
    medicationAdherenceRate: number;
    aiHealthNote: string;
  };
}

interface Props {
  onNavigateTab: (tab: 'dashboard' | 'alerts' | 'family' | 'medication') => void;
}

export const CaregiverDashboardScreen: React.FC<Props> = ({ onNavigateTab }) => {
  const { user } = useAuthStore();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedElderlyId, setSelectedElderlyId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch linked family members
  const fetchFamilyMembers = async () => {
    try {
      const res = await apiClient<FamilyMember[]>('/api/family/members');
      if (res.success && res.data && res.data.length > 0) {
        setFamilyMembers(res.data);
        if (!selectedElderlyId) {
          setSelectedElderlyId(res.data[0].member.id);
        }
      }
    } catch {
      // Handled
    }
  };

  // 2. Fetch overview for selected elderly
  const fetchOverview = async (targetId?: number | null) => {
    try {
      const idToFetch = targetId !== undefined ? targetId : selectedElderlyId;
      const url = idToFetch ? `/api/dashboard/overview?elderlyId=${idToFetch}` : '/api/dashboard/overview';
      const res = await apiClient<DashboardOverview>(url);
      if (res.success && res.data) {
        setData(res.data);
        if (!selectedElderlyId && res.data.elderly?.id) {
          setSelectedElderlyId(res.data.elderly.id);
        }
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFamilyMembers();
  }, []);

  useEffect(() => {
    if (selectedElderlyId) {
      setLoading(true);
      fetchOverview(selectedElderlyId);
    } else {
      fetchOverview();
    }
  }, [selectedElderlyId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFamilyMembers();
    fetchOverview(selectedElderlyId);
  };

  const getStatusVisuals = (status?: string) => {
    switch (status) {
      case 'NORMAL':
        return { label: 'BÌNH THƯỜNG', color: colors.successText, bg: colors.success, iconName: 'check-circle' as const };
      case 'REMINDER_REQUIRED':
        return { label: 'CẦN NHẮC NHỞ', color: '#995C17', bg: '#FEF6EC', iconName: 'bell' as const };
      case 'NEEDS_ATTENTION':
        return { label: 'CẦN LƯU Ý', color: '#C2410C', bg: '#FFEDD5', iconName: 'alert-triangle' as const };
      case 'CRITICAL':
        return { label: 'CẢNH BÁO KHẨN', color: colors.dangerText, bg: colors.danger, iconName: 'alert-octagon' as const };
      default:
        return { label: 'BÌNH THƯỜNG', color: colors.successText, bg: colors.success, iconName: 'check-circle' as const };
    }
  };

  const statusVisual = getStatusVisuals(data?.careStatus);
  const adherencePercent = Math.round((data?.medicationAdherence ?? 1.0) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Caregiver Welcome Bar */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/images/mimamori-leaf-icon.png')}
            style={{ width: 34, height: 34, marginRight: 10 }}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.caregiverRole}>GIÁM SÁT TỪ XA • MIMAMORI</Text>
            <Text style={styles.caregiverName}>Chào {user?.fullName || 'Người chăm sóc'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshPill} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={13} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.refreshText}>Cập nhật</Text>
        </TouchableOpacity>
      </View>

      {/* Linked Elderly Selector Pills (Synchronized with Family Relationships) */}
      {familyMembers.length > 0 && (
        <View style={styles.selectorWrap}>
          <Text style={styles.selectorLabel}>CHỌN NGƯỜI THÂN ĐANG THEO DÕI:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
            {familyMembers.map((fm) => {
              const isSelected = selectedElderlyId === fm.member.id;
              return (
                <TouchableOpacity
                  key={fm.member.id}
                  style={[styles.memberPill, isSelected && styles.memberPillActive]}
                  onPress={() => setSelectedElderlyId(fm.member.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.pillAvatar, isSelected && styles.pillAvatarActive]}>
                    <Feather name="user" size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.pillName, isSelected && styles.pillNameActive]}>
                      {fm.member.fullName}
                    </Text>
                    <Text style={[styles.pillRelation, isSelected && styles.pillRelationActive]}>
                      {fm.relationshipType || 'Người thân'} (@{fm.member.username})
                    </Text>
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

      {/* Monitored Elderly Banner */}
      <View style={styles.elderlyCard}>
        <View style={styles.elderlyAvatar}>
          <Feather name="user" size={24} color={colors.primary} />
        </View>
        <View style={styles.elderlyInfoCol}>
          <Text style={styles.elderlyName}>{data?.elderly?.fullName || 'Người cao tuổi'}</Text>
          <Text style={styles.elderlyRelation}>
            Tài khoản: @{data?.elderly?.username || 'nguoi_cao_tuoi'}
            {data?.elderly?.phoneNumber ? ` • SĐT: ${data.elderly.phoneNumber}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusVisual.bg }]}>
          <Feather name={statusVisual.iconName} size={13} color={statusVisual.color} style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: statusVisual.color }]}>
            {statusVisual.label}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang đồng bộ dữ liệu người cao tuổi...</Text>
        </View>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <View style={styles.metricsRow}>
            {/* Adherence Rate */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
                <Text style={styles.metricLabel}>Uống thuốc</Text>
              </View>
              <Text style={[styles.metricValue, { color: adherencePercent >= 80 ? colors.successText : '#C2410C' }]}>
                {adherencePercent}%
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${adherencePercent}%`,
                      backgroundColor: adherencePercent >= 80 ? colors.primary : '#F97316',
                    },
                  ]}
                />
              </View>
              <Text style={styles.metricSub}>
                Hôm nay: {data?.todayMedications?.filter((m) => m.status === 'TAKEN').length || 0}/
                {data?.todayMedications?.length || 0} cữ đã uống
              </Text>
            </View>

            {/* Check-in Status */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <Feather name="check-circle" size={16} color={data?.todayCheckIn ? colors.primary : '#D97706'} />
                <Text style={styles.metricLabel}>Điểm danh</Text>
              </View>
              {data?.todayCheckIn ? (
                <>
                  <Text style={[styles.metricValue, { color: colors.successText }]}>Đã xong</Text>
                  <Text style={styles.checkInDetailText} numberOfLines={1}>
                    Tâm trạng: {data.todayCheckIn.mood}
                  </Text>
                  <Text style={styles.checkInDetailText} numberOfLines={1}>
                    Thể trạng: {data.todayCheckIn.physicalHealth}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.metricValue, { color: '#D97706' }]}>Chưa gửi</Text>
                  <Text style={styles.metricSub}>Cụ chưa gửi thông tin thăm hỏi hôm nay</Text>
                </>
              )}
            </View>
          </View>

          {/* Today's Detailed Medication Schedule (Synchronized) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="pill" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Lịch thuốc của cụ hôm nay</Text>
              </View>
              <TouchableOpacity onPress={() => onNavigateTab('medication')}>
                <Text style={styles.seeAllText}>Quản lý ›</Text>
              </TouchableOpacity>
            </View>

            {(!data?.todayMedications || data.todayMedications.length === 0) ? (
              <View style={styles.emptyInlineBox}>
                <Feather name="calendar" size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyInlineText}>Hôm nay cụ chưa có lịch uống thuốc nào.</Text>
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
                      <Text style={styles.medDoseText}>
                        Liều: {med.dosage} • Giờ: {med.scheduledTime ? med.scheduledTime.slice(0, 5) : '08:00'}
                      </Text>
                    </View>
                    <View style={[styles.medBadge, { backgroundColor: isTaken ? colors.success : colors.surfaceWarm }]}>
                      <Text style={[styles.medBadgeText, { color: isTaken ? colors.successText : colors.textSecondary }]}>
                        {isTaken ? 'Đã uống' : med.status === 'MISSED' ? 'Trễ giờ' : 'Chờ uống'}
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
                <Text style={styles.sectionTitle}>Cảnh báo cần chú ý</Text>
              </View>
              <TouchableOpacity onPress={() => onNavigateTab('alerts')}>
                <Text style={styles.seeAllText}>Xem tất cả ({data?.activeAlerts?.length || 0}) ›</Text>
              </TouchableOpacity>
            </View>

            {(!data?.activeAlerts || data.activeAlerts.length === 0) ? (
              <View style={styles.emptyAlertsBox}>
                <View style={styles.shieldIconWrap}>
                  <Feather name="shield" size={26} color={colors.successText} />
                </View>
                <Text style={styles.emptyAlertsText}>Không có cảnh báo khẩn cấp nào</Text>
                <Text style={styles.emptyAlertsSub}>Người cao tuổi đang sinh hoạt trong điều kiện ổn định.</Text>
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
                <Text style={styles.summaryTitle}>Báo cáo thông minh từ Care Agent</Text>
                <Text style={styles.summarySub}>Tổng hợp tự động hoạt động và sức khỏe</Text>
              </View>
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryText}>
                <Text style={{ fontWeight: '700' }}>Điểm danh: </Text>
                {data?.recentSummary?.checkinSummary || (data?.todayCheckIn ? `Hôm nay tâm trạng ${data.todayCheckIn.mood}, thể trạng ${data.todayCheckIn.physicalHealth}, giấc ngủ ${data.todayCheckIn.sleepQuality}.` : 'Chưa hoàn thành điểm danh hôm nay.')}
              </Text>
              <Text style={[styles.summaryText, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '700' }}>Ghi chú AI: </Text>
                {data?.recentSummary?.aiHealthNote || 'Gia đình hãy nhắc cụ uống đủ nước ấm và giữ ấm cơ thể trong ngày hôm nay.'}
              </Text>
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
    padding: 16,
  },
  topHeader: {
    flexDirection: 'row',
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
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  elderlyInfoCol: {
    flex: 1,
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
    height: 48,
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
    lineHeight: 16,
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
    height: 36,
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
    lineHeight: 20,
  },
});