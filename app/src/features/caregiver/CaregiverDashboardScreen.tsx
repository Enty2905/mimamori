import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { getAvatarSource } from '../../core/theme/avatar';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { useCaregiverStore } from '../../core/caregiver/useCaregiverStore';
import { apiClient } from '../../core/api/client';
import {
  CareAlertDto,
  CaregiverUserDto,
  DailyCheckInDto,
  DailySummaryDto,
  FamilyMemberDto,
  MedicationLogDto,
  formatConciseAlertDescription,
  formatTimeHHMM,
  getAlertTitle,
  getCareStatusMeta,
  getMedicationDisplayStatus,
  getSeverityMeta,
  isAlertResolved,
} from '../../core/utils/caregiverHelpers';
import { CaregiverHeader } from '../../components/caregiver/CaregiverHeader';
import { FamilyMemberSelector } from '../../components/caregiver/FamilyMemberSelector';

interface DashboardOverview {
  elderly: CaregiverUserDto & {
    phoneNumber?: string | null;
  };
  careStatus: 'NORMAL' | 'REMINDER_REQUIRED' | 'NEEDS_ATTENTION' | 'CRITICAL' | string;
  medicationAdherence: number;
  todayCheckIn?: (DailyCheckInDto & { aiAnalysis?: string | null }) | null;
  todayMedications: MedicationLogDto[];
  activeAlerts: CareAlertDto[];
  recentSummary?: DailySummaryDto | null;
}

interface Props {
  onNavigateTab: (tab: 'dashboard' | 'alerts' | 'family' | 'medication') => void;
}

function extractShortName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
}

function formatNowHHMM(): string {
  return `${formatTimeHHMM(new Date().toISOString())} hôm nay`;
}

function deriveCareStatusReason(
  data: DashboardOverview | null,
  unresolvedAlerts: CareAlertDto[]
): string | null {
  if (!data) return null;

  const needsReason =
    (data.careStatus && data.careStatus !== 'NORMAL') || unresolvedAlerts.length > 0;
  if (!needsReason) return null;

  const firstAlert = unresolvedAlerts[0];
  if (firstAlert) {
    const alertDesc = formatConciseAlertDescription(
      firstAlert.description,
      firstAlert.elderlyName || data.elderly?.fullName
    );
    if (alertDesc) return alertDesc;
    return getAlertTitle(firstAlert.alertType, firstAlert.title);
  }

  const meds = data.todayMedications ?? [];
  let missedCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;

  for (const med of meds) {
    const status = getMedicationDisplayStatus(med);
    if (status.key === 'MISSED') missedCount += 1;
    else if (status.key === 'OVERDUE') overdueCount += 1;
    else if (status.key === 'PENDING') pendingCount += 1;
  }

  if (missedCount > 0) {
    return `Có ${missedCount} cữ thuốc đã bỏ lỡ hôm nay.`;
  }
  if (overdueCount > 0) {
    return `Có ${overdueCount} cữ thuốc đã quá giờ uống.`;
  }
  if (!data.todayCheckIn) {
    return 'Người thân chưa thực hiện điểm danh hôm nay.';
  }
  if (data.todayCheckIn.concerningFlag) {
    return 'Điểm danh hôm nay ghi nhận dấu hiệu sức khỏe cần lưu ý.';
  }
  if (pendingCount > 0) {
    return `Còn ${pendingCount} cữ thuốc đang chờ uống hôm nay.`;
  }

  return 'Cần theo dõi thêm tình trạng trong ngày hôm nay.';
}

export const CaregiverDashboardScreen: React.FC<Props> = ({ onNavigateTab }) => {
  const { user } = useAuthStore();
  const { fs } = useAccessibilityStore();

  const [familyMembers, setFamilyMembers] = useState<FamilyMemberDto[]>([]);
  const { selectedElderlyId, setSelectedElderlyId, setSelectedElderlyName } = useCaregiverStore();
  const [statusByMemberId, setStatusByMemberId] = useState<Record<number, string | undefined>>({});
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const selectedElderlyIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedElderlyIdRef.current = selectedElderlyId;
  }, [selectedElderlyId]);

  const fetchMemberStatusesInBackground = useCallback(
    async (members: FamilyMemberDto[], activeId: number | null) => {
      const others = members.filter((m) => m.member.id !== activeId);
      if (others.length === 0) return;

      const results = await Promise.allSettled(
        others.map((m) =>
          apiClient<DashboardOverview>(`/api/dashboard/overview?elderlyId=${m.member.id}`)
        )
      );

      setStatusByMemberId((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.data) {
            const memberId = others[index].member.id;
            next[memberId] = result.value.data.careStatus;
          }
        });
        return next;
      });
    },
    []
  );

  const fetchOverview = useCallback(
    async (targetId?: number | null, isRefresh = false) => {
      if (!isRefresh) {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const idToFetch = targetId !== undefined ? targetId : selectedElderlyIdRef.current;
        const url = idToFetch
          ? `/api/dashboard/overview?elderlyId=${idToFetch}`
          : '/api/dashboard/overview';
        const res = await apiClient<DashboardOverview>(url);

        if (res.success && res.data) {
          setData(res.data);
          setLastUpdated(formatNowHHMM());
          const elderlyId = res.data.elderly?.id;
          if (elderlyId) {
            setStatusByMemberId((prev) => ({
              ...prev,
              [elderlyId]: res.data.careStatus,
            }));
            if (!selectedElderlyIdRef.current) {
              setSelectedElderlyId(elderlyId);
            }
          }
        } else {
          setErrorMessage(res.message || 'Không thể tải dữ liệu tổng quan.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Không thể kết nối máy chủ.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const fetchFamilyMembers = useCallback(
    async (isRefresh = false) => {
      try {
        const res = await apiClient<FamilyMemberDto[]>('/api/family/members');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const members = res.data;
          setFamilyMembers(members);

          const currentId = selectedElderlyIdRef.current;
          const stillExists = currentId && members.some((m) => m.member.id === currentId);
          const nextSelectedId = stillExists ? currentId : members[0].member.id;

          if (nextSelectedId !== currentId) {
            setSelectedElderlyId(nextSelectedId);
          } else {
            await fetchOverview(nextSelectedId, isRefresh);
          }

          fetchMemberStatusesInBackground(members, nextSelectedId);
        } else {
          setFamilyMembers([]);
          await fetchOverview(null, isRefresh);
        }
      } catch {
        await fetchOverview(selectedElderlyIdRef.current, isRefresh);
      }
    },
    [fetchMemberStatusesInBackground, fetchOverview, setSelectedElderlyId]
  );

  useEffect(() => {
    fetchFamilyMembers(false);
  }, [fetchFamilyMembers]);

  useEffect(() => {
    if (selectedElderlyId !== null) {
      fetchOverview(selectedElderlyId, false);
    }
  }, [selectedElderlyId, fetchOverview]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFamilyMembers(true);
  }, [fetchFamilyMembers]);

  const handleSelectMember = useCallback(
    (elderlyId: number) => {
      if (elderlyId === selectedElderlyId) {
        fetchOverview(elderlyId, true);
        return;
      }
      setSelectedElderlyId(elderlyId);
    },
    [selectedElderlyId, fetchOverview, setSelectedElderlyId]
  );

  const shortName = useMemo(() => extractShortName(user?.fullName), [user?.fullName]);
  const headerTitle = `Xin chào, ${shortName || 'Người chăm sóc'} 👋`;
  const headerSubtitle =
    familyMembers.length > 0
      ? `Hôm nay bạn đang theo dõi ${familyMembers.length} người thân`
      : 'Theo dõi sức khỏe gia đình từ xa';

  const selectedMember = useMemo(
    () =>
      familyMembers.find(
        (fm) => fm.member.id === (data?.elderly?.id ?? selectedElderlyId)
      ) ?? null,
    [familyMembers, data?.elderly?.id, selectedElderlyId]
  );

  const elderlyName =
    data?.elderly?.fullName || selectedMember?.member?.fullName || 'Người cao tuổi';
  const elderlyPhone =
    data?.elderly?.phone || data?.elderly?.phoneNumber || selectedMember?.member?.phone;

  useEffect(() => {
    const resolvedName = data?.elderly?.fullName || selectedMember?.member?.fullName || null;
    if (resolvedName) {
      setSelectedElderlyName(resolvedName);
    }
  }, [data?.elderly?.fullName, selectedMember?.member?.fullName, setSelectedElderlyName]);
  const elderlyAvatar =
    data?.elderly?.avatarUrl ?? selectedMember?.member?.avatarUrl;

  const careStatusMeta = getCareStatusMeta(data?.careStatus);

  const unresolvedAlerts = useMemo(
    () => (data?.activeAlerts ?? []).filter((a) => !isAlertResolved(a)),
    [data?.activeAlerts]
  );

  const statusReason = useMemo(
    () => deriveCareStatusReason(data, unresolvedAlerts),
    [data, unresolvedAlerts]
  );

  // Medication KPI calculations
  const todayMeds = useMemo(
    () => data?.todayMedications ?? [],
    [data?.todayMedications]
  );
  const totalMeds = todayMeds.length;

  const medMetrics = useMemo(() => {
    let taken = 0;
    let missedOrOverdue = 0;

    for (const med of todayMeds) {
      const display = getMedicationDisplayStatus(med);
      if (display.key === 'TAKEN') taken += 1;
      else if (display.key === 'MISSED' || display.key === 'OVERDUE') missedOrOverdue += 1;
    }

    const rawAdherence = data?.medicationAdherence ?? (totalMeds > 0 ? taken / totalMeds : 1);
    const scaled = rawAdherence > 1 ? Math.round(rawAdherence) : Math.round(rawAdherence * 100);
    const percent = Math.max(0, Math.min(100, scaled));

    let color: string = colors.successText;
    if (missedOrOverdue > 0) {
      color = colors.dangerText;
    } else if ((totalMeds > 0 && taken === totalMeds) || percent >= 80) {
      color = colors.successText;
    } else {
      color = colors.warningText;
    }

    return { taken, percent, color };
  }, [todayMeds, totalMeds, data?.medicationAdherence]);

  // Check-in KPI details
  const todayCheckIn = data?.todayCheckIn ?? null;
  const checkInTime = todayCheckIn?.createdAt ? formatTimeHHMM(todayCheckIn.createdAt) : null;
  const hasValidCheckInTime = Boolean(checkInTime && checkInTime !== '--:--');

  // AI Summary real backend fields
  const checkinSummaryText = data?.recentSummary?.checkinSummary?.trim() || '';
  const aiHealthNoteText = data?.recentSummary?.aiHealthNote?.trim() || '';
  const checkInAiText =
    (todayCheckIn?.aiAnalysisSummary ?? todayCheckIn?.aiAnalysis)?.trim() || '';
  const hasAiSummary = Boolean(checkinSummaryText || aiHealthNoteText || checkInAiText);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* A. Header */}
      <CaregiverHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      {/* B. Family Member Selector */}
      {familyMembers.length > 0 && (
        <View style={styles.selectorSection}>
          <FamilyMemberSelector
            members={familyMembers}
            selectedId={selectedElderlyId}
            onSelect={handleSelectMember}
            statusByMemberId={statusByMemberId}
          />
        </View>
      )}

      <View style={styles.body}>
        {loading && !data ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { fontSize: fs(14) }]}>
              Đang đồng bộ dữ liệu sức khỏe...
            </Text>
          </View>
        ) : (
          <>
            {Boolean(errorMessage) && (
              <TouchableOpacity
                style={styles.errorBanner}
                onPress={onRefresh}
                activeOpacity={0.8}
              >
                <Feather name="wifi-off" size={16} color={colors.dangerText} />
                <Text style={[styles.errorBannerText, { fontSize: fs(13) }]}>
                  {errorMessage} Nhấn để thử lại.
                </Text>
              </TouchableOpacity>
            )}

            {/* C. Elderly Status Card */}
            <View style={styles.elderlyCard}>
              <View style={styles.elderlyTopRow}>
                <Image
                  source={getAvatarSource(elderlyAvatar)}
                  style={styles.elderlyAvatar}
                />
                <View style={styles.elderlyInfoCol}>
                  <Text
                    style={[
                      styles.elderlyName,
                      { fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.32) },
                    ]}
                  >
                    {elderlyName}
                  </Text>
                  <Text
                    style={[
                      styles.elderlyMeta,
                      { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4) },
                    ]}
                  >
                    {selectedMember?.relationshipType
                      ? `Quan hệ: ${selectedMember.relationshipType}`
                      : 'Người cao tuổi'}
                    {elderlyPhone ? ` • ${elderlyPhone}` : ''}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: careStatusMeta.bg,
                      borderColor: careStatusMeta.border,
                    },
                  ]}
                >
                  <Feather
                    name={careStatusMeta.icon}
                    size={13}
                    color={careStatusMeta.text}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: careStatusMeta.text, fontSize: fs(11.5) },
                    ]}
                  >
                    {careStatusMeta.label}
                  </Text>
                </View>
              </View>

              {Boolean(statusReason) && (
                <View
                  style={[
                    styles.reasonBox,
                    {
                      backgroundColor: careStatusMeta.bg,
                      borderColor: careStatusMeta.border,
                    },
                  ]}
                >
                  <Feather
                    name={careStatusMeta.icon}
                    size={15}
                    color={careStatusMeta.text}
                    style={styles.reasonIcon}
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      {
                        color: careStatusMeta.text,
                        fontSize: fs(13),
                        lineHeight: Math.round(fs(13) * 1.45),
                      },
                    ]}
                  >
                    {statusReason}
                  </Text>
                </View>
              )}

              <View style={styles.elderlyFooter}>
                <Feather name="clock" size={12} color={colors.textMuted} />
                <Text style={[styles.elderlyUpdatedText, { fontSize: fs(11.5) }]}>
                  Cập nhật lần cuối: {lastUpdated || formatNowHHMM()}
                </Text>
              </View>
            </View>

            {/* D. Two KPI Health Cards side-by-side */}
            <View style={styles.metricsRow}>
              {/* Card 1: Uống thuốc */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <View style={styles.metricIconBadge}>
                    <MaterialCommunityIcons name="pill" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.metricLabel, { fontSize: fs(13) }]}>Uống thuốc</Text>
                </View>

                <Text
                  style={[
                    styles.metricBigValue,
                    { color: medMetrics.color, fontSize: fs(26) },
                  ]}
                >
                  {medMetrics.percent}%
                </Text>

                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${medMetrics.percent}%`,
                        backgroundColor: medMetrics.color,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.metricFooterText,
                    { fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.4) },
                  ]}
                >
                  {medMetrics.taken}/{totalMeds} cữ đã uống
                </Text>
              </View>

              {/* Card 2: Điểm danh */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <View
                    style={[
                      styles.metricIconBadge,
                      {
                        backgroundColor: todayCheckIn ? colors.success : colors.warning,
                      },
                    ]}
                  >
                    <Feather
                      name="check-circle"
                      size={15}
                      color={todayCheckIn ? colors.successText : colors.warningText}
                    />
                  </View>
                  <Text style={[styles.metricLabel, { fontSize: fs(13) }]}>Điểm danh</Text>
                </View>

                {todayCheckIn ? (
                  <>
                    <Text
                      style={[
                        styles.checkInStatusDone,
                        { fontSize: fs(16) },
                      ]}
                    >
                      Đã hoàn thành
                    </Text>

                    <Text
                      style={[
                        styles.checkInDetailText,
                        { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4) },
                      ]}
                    >
                      <Text style={styles.checkInDetailLabel}>Tâm trạng: </Text>
                      {todayCheckIn.mood}
                    </Text>

                    <Text
                      style={[
                        styles.checkInDetailText,
                        { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4) },
                      ]}
                    >
                      <Text style={styles.checkInDetailLabel}>Thể trạng: </Text>
                      {todayCheckIn.physicalHealth}
                    </Text>

                    {hasValidCheckInTime && (
                      <View style={styles.checkInTimeRow}>
                        <Feather name="clock" size={11} color={colors.textMuted} />
                        <Text style={[styles.checkInTimeText, { fontSize: fs(11.5) }]}>
                          Lúc {checkInTime}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.checkInStatusPending,
                        { fontSize: fs(15) },
                      ]}
                    >
                      Chưa điểm danh hôm nay
                    </Text>
                    <Text
                      style={[
                        styles.metricFooterText,
                        { fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.4) },
                      ]}
                    >
                      Người thân chưa gửi thông tin thăm hỏi trong ngày.
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* E. Today's Medication Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWrap}>
                  <MaterialCommunityIcons
                    name="pill"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.sectionTitle, { fontSize: fs(15.5) }]}>
                    Lịch thuốc hôm nay
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => onNavigateTab('medication')}
                  style={styles.seeAllButton}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.seeAllText, { fontSize: fs(13) }]}>
                    Xem tất cả →
                  </Text>
                </TouchableOpacity>
              </View>

              {todayMeds.length === 0 ? (
                <View style={styles.emptyInlineBox}>
                  <Feather name="calendar" size={22} color={colors.textMuted} />
                  <Text style={[styles.emptyInlineText, { fontSize: fs(13) }]}>
                    Hôm nay chưa có lịch uống thuốc nào.
                  </Text>
                </View>
              ) : (
                <View style={styles.medList}>
                  {todayMeds.slice(0, 4).map((med, idx) => {
                    const displayStatus = getMedicationDisplayStatus(med);
                    const timeStr = formatTimeHHMM(med.scheduledTime);
                    const isLast = idx === Math.min(todayMeds.length, 4) - 1;

                    return (
                      <View
                        key={med.id}
                        style={[styles.medRowItem, isLast && styles.medRowItemLast]}
                      >
                        <View
                          style={[
                            styles.medStatusDot,
                            {
                              backgroundColor: displayStatus.bg,
                              borderColor: displayStatus.border,
                            },
                          ]}
                        >
                          <Feather
                            name={displayStatus.icon}
                            size={13}
                            color={displayStatus.text}
                          />
                        </View>

                        <View style={styles.medInfoCol}>
                          <Text style={[styles.medNameText, { fontSize: fs(14) }]}>
                            {med.medicationName}
                          </Text>
                          <Text style={[styles.medDoseText, { fontSize: fs(12) }]}>
                            {med.dosage ? `${timeStr} • Liều: ${med.dosage}` : timeStr}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.medBadge,
                            {
                              backgroundColor: displayStatus.bg,
                              borderColor: displayStatus.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.medBadgeText,
                              { color: displayStatus.text, fontSize: fs(11.5) },
                            ]}
                          >
                            {displayStatus.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* F. Active Alerts Quick Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWrap}>
                  <Feather
                    name="alert-triangle"
                    size={18}
                    color={
                      unresolvedAlerts.length > 0 ? colors.dangerText : colors.primary
                    }
                  />
                  <Text style={[styles.sectionTitle, { fontSize: fs(15.5) }]}>
                    Cảnh báo cần chú ý ({unresolvedAlerts.length})
                  </Text>
                </View>
              </View>

              {unresolvedAlerts.length === 0 ? (
                <View style={styles.emptyAlertsBox}>
                  <View style={styles.shieldIconWrap}>
                    <Feather name="shield" size={24} color={colors.successText} />
                  </View>
                  <Text style={[styles.emptyAlertsTitle, { fontSize: fs(14) }]}>
                    Tình trạng ổn định
                  </Text>
                  <Text
                    style={[
                      styles.emptyAlertsSub,
                      { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4) },
                    ]}
                  >
                    Hôm nay chưa có cảnh báo nào. Người thân của bạn đang được theo dõi.
                  </Text>
                </View>
              ) : (
                <View style={styles.alertList}>
                  {unresolvedAlerts.slice(0, 3).map((alert) => {
                    const sevMeta = getSeverityMeta(alert.severity);
                    const alertTitle = getAlertTitle(alert.alertType, alert.title);
                    const alertTime = formatTimeHHMM(alert.createdAt);

                    return (
                      <View
                        key={alert.id}
                        style={[
                          styles.alertItem,
                          {
                            backgroundColor: sevMeta.bg,
                            borderColor: sevMeta.border,
                          },
                        ]}
                      >
                        <View style={styles.alertTopRow}>
                          <View
                            style={[
                              styles.severityBadge,
                              {
                                backgroundColor: colors.surface,
                                borderColor: sevMeta.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.severityBadgeText,
                                { color: sevMeta.text, fontSize: fs(11) },
                              ]}
                            >
                              {sevMeta.label}
                            </Text>
                          </View>

                          <Text style={[styles.alertTimeText, { fontSize: fs(11.5) }]}>
                            {alertTime}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.alertItemTitle,
                            { color: sevMeta.text, fontSize: fs(14) },
                          ]}
                        >
                          {alertTitle}
                        </Text>

                        {Boolean(alert.description?.trim()) && (
                          <Text
                            style={[
                              styles.alertItemDesc,
                              { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4) },
                            ]}
                          >
                            {formatConciseAlertDescription(
                              alert.description,
                              alert.elderlyName || elderlyName
                            )}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={styles.alertsActionBtn}
                onPress={() => onNavigateTab('alerts')}
                activeOpacity={0.75}
              >
                <Text style={[styles.alertsActionText, { fontSize: fs(13) }]}>
                  Xem tất cả cảnh báo
                </Text>
                <Feather name="arrow-right" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* G. AI Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <View style={styles.summaryIconWrap}>
                  <Feather name="cpu" size={18} color={colors.primary} />
                </View>
                <View style={styles.summaryHeaderTextCol}>
                  <Text style={[styles.summaryTitle, { fontSize: fs(15.5) }]}>
                    Tóm tắt sức khỏe từ Mimamori AI
                  </Text>
                </View>
              </View>

              {hasAiSummary ? (
                <View style={styles.summaryContent}>
                  {Boolean(checkinSummaryText) && (
                    <Text
                      style={[
                        styles.summaryText,
                        { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.45) },
                      ]}
                    >
                      <Text style={styles.summaryTextBold}>Điểm danh: </Text>
                      {checkinSummaryText}
                    </Text>
                  )}

                  {Boolean(checkInAiText) && checkInAiText !== aiHealthNoteText && (
                    <Text
                      style={[
                        styles.summaryText,
                        { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.45) },
                        Boolean(checkinSummaryText) && styles.summaryTextSpaced,
                      ]}
                    >
                      <Text style={styles.summaryTextBold}>Phân tích AI: </Text>
                      {checkInAiText}
                    </Text>
                  )}

                  {Boolean(aiHealthNoteText) && (
                    <Text
                      style={[
                        styles.summaryText,
                        { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.45) },
                        Boolean(checkinSummaryText || checkInAiText) &&
                          styles.summaryTextSpaced,
                      ]}
                    >
                      <Text style={styles.summaryTextBold}>Ghi chú sức khỏe: </Text>
                      {aiHealthNoteText}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.summaryEmptyBox}>
                  <Text style={[styles.summaryEmptyText, { fontSize: fs(13) }]}>
                    Chưa có tóm tắt sức khỏe hôm nay.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 110,
  },
  selectorSection: {
    marginBottom: 10,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 4,
    gap: 14,
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: colors.dangerText,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },

  // C. Elderly Status Card
  elderlyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
    ...shadows.subtle,
  },
  elderlyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  elderlyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  elderlyInfoCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 170,
    minWidth: 0,
  },
  elderlyName: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  elderlyMeta: {
    color: colors.textSecondary,
    marginTop: 2,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontWeight: '800',
    flexShrink: 1,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  reasonText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontWeight: '600',
  },
  elderlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  elderlyUpdatedText: {
    color: colors.textMuted,
    fontWeight: '500',
    flexShrink: 1,
  },

  // D. KPI Cards
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  metricIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricLabel: {
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
    minWidth: 0,
  },
  metricBigValue: {
    fontWeight: '900',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 7,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricFooterText: {
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  checkInStatusDone: {
    fontWeight: '800',
    color: colors.successText,
    marginBottom: 6,
    flexShrink: 1,
  },
  checkInStatusPending: {
    fontWeight: '800',
    color: colors.warningText,
    marginBottom: 6,
    flexShrink: 1,
  },
  checkInDetailText: {
    color: colors.textPrimary,
    marginTop: 2,
    flexShrink: 1,
  },
  checkInDetailLabel: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  checkInTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  checkInTimeText: {
    color: colors.textMuted,
    fontWeight: '600',
    flexShrink: 1,
  },

  // E & F. Shared Section Card
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  seeAllButton: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeAllText: {
    fontWeight: '700',
    color: colors.primary,
  },
  emptyInlineBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyInlineText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // E. Medication List
  medList: {
    gap: 2,
  },
  medRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  medRowItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  medStatusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  medInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  medNameText: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  medDoseText: {
    color: colors.textSecondary,
    marginTop: 2,
    flexShrink: 1,
  },
  medBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  medBadgeText: {
    fontWeight: '700',
  },

  // F. Alerts Quick Card
  emptyAlertsBox: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  shieldIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyAlertsTitle: {
    fontWeight: '700',
    color: colors.successText,
    textAlign: 'center',
  },
  emptyAlertsSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  alertList: {
    gap: 10,
  },
  alertItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  severityBadgeText: {
    fontWeight: '800',
  },
  alertTimeText: {
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  alertItemTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  alertItemDesc: {
    color: colors.textPrimary,
    flexShrink: 1,
  },
  alertsActionBtn: {
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertsActionText: {
    fontWeight: '700',
    color: colors.primary,
  },

  // G. AI Summary Card
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
    gap: 10,
    marginBottom: 12,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryHeaderTextCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  summaryContent: {
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    borderRadius: 14,
  },
  summaryText: {
    color: colors.textPrimary,
    flexShrink: 1,
  },
  summaryTextBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryTextSpaced: {
    marginTop: 8,
  },
  summaryEmptyBox: {
    backgroundColor: colors.surfaceWarm,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  summaryEmptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
