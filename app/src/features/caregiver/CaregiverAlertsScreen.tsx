import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { apiClient } from '../../core/api/client';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { useCaregiverStore } from '../../core/caregiver/useCaregiverStore';
import { CaregiverHeader } from '../../components/caregiver/CaregiverHeader';
import type { FamilyMemberDto } from '../../core/utils/caregiverHelpers';
import {
  CareAlertDto,
  formatConciseAlertDescription,
  formatDateDisplayVi,
  formatTimeHHMM,
  getAlertTitle,
  getAlertTypeLabel,
  getSeverityMeta,
  isAlertResolved,
  parseIsoDateTime,
} from '../../core/utils/caregiverHelpers';

type AlertFilterKey = 'UNRESOLVED' | 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CaregiverAlertsScreenProps {
  onAlertsChanged?: (unresolvedCount: number) => void;
}

const FILTER_CHIPS: Array<{ key: AlertFilterKey; label: string }> = [
  { key: 'UNRESOLVED', label: 'Chưa xử lý' },
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CRITICAL', label: 'Khẩn cấp' },
  { key: 'HIGH', label: 'Mức cao' },
  { key: 'MEDIUM', label: 'Trung bình' },
  { key: 'LOW', label: 'Thông tin' },
];

const formatFullDateVi = (iso?: string | null): string => {
  const parsed = parseIsoDateTime(iso);
  if (!parsed) return '--/--/----';
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const relativePart = formatDateDisplayVi(parsed).split(' • ')[0];
  return `${relativePart} • ${dd}/${mm}/${yyyy}`;
};

export const CaregiverAlertsScreen: React.FC<CaregiverAlertsScreenProps> = ({
  onAlertsChanged,
}) => {
  const { fs } = useAccessibilityStore();
  const { selectedElderlyId, setSelectedElderlyId } = useCaregiverStore();
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [rawAlerts, setRawAlerts] = useState<CareAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filter, setFilter] = useState<AlertFilterKey>('UNRESOLVED');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // Detail & Confirmation modal state
  const [selectedAlert, setSelectedAlert] = useState<CareAlertDto | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [sessionNotesByAlertId, setSessionNotesByAlertId] = useState<Record<number, string>>({});

  const alerts = useMemo(() => {
    if (selectedElderlyId === null) return rawAlerts;
    return rawAlerts.filter((item) => item.elderlyId === selectedElderlyId);
  }, [rawAlerts, selectedElderlyId]);

  useEffect(() => {
    const unresolved = alerts.filter((item) => !isAlertResolved(item)).length;
    onAlertsChanged?.(unresolved);
  }, [alerts, onAlertsChanged]);

  const selectedElderlyName = useMemo(() => {
    const fromMembers = members.find((m) => m.member.id === selectedElderlyId)?.member?.fullName;
    return fromMembers || alerts[0]?.elderlyName || null;
  }, [alerts, members, selectedElderlyId]);

  const fetchAlerts = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setErrorMessage(null);

        const [alertsRes, membersRes] = await Promise.all([
          apiClient<CareAlertDto[]>('/api/alerts'),
          apiClient<FamilyMemberDto[]>('/api/family/members').catch(() => null),
        ]);
        if (membersRes?.success && Array.isArray(membersRes.data)) {
          const elderlyOnly = membersRes.data.filter((item) => item.member?.role === 'ELDERLY');
          setMembers(elderlyOnly);
          const currentSelected = useCaregiverStore.getState().selectedElderlyId;
          if (
            elderlyOnly.length > 0 &&
            (currentSelected === null || !elderlyOnly.some((m) => m.member.id === currentSelected))
          ) {
            setSelectedElderlyId(elderlyOnly[0].member.id);
          }
        }
        if (alertsRes.success && Array.isArray(alertsRes.data)) {
          setRawAlerts(alertsRes.data);
          setLastUpdated(`Cập nhật ${formatTimeHHMM(new Date().toISOString())} hôm nay`);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Không thể tải danh sách cảnh báo.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [setSelectedElderlyId]
  );

  useEffect(() => {
    fetchAlerts(false);
  }, [fetchAlerts]);

  const summaryCounts = useMemo(() => {
    const counts = {
      unresolved: 0,
      all: alerts.length,
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      totalBySeverity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
    };

    for (const item of alerts) {
      const resolved = isAlertResolved(item);
      const sev = item.severity?.toUpperCase() || 'LOW';
      if (sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW') {
        counts.totalBySeverity[sev] += 1;
      }
      if (!resolved) {
        counts.unresolved += 1;
        if (sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW') {
          counts[sev] += 1;
        }
      }
    }

    return counts;
  }, [alerts]);

  const getChipCount = (key: AlertFilterKey): number => {
    switch (key) {
      case 'UNRESOLVED':
        return summaryCounts.unresolved;
      case 'ALL':
        return summaryCounts.all;
      case 'CRITICAL':
        return summaryCounts.totalBySeverity.CRITICAL;
      case 'HIGH':
        return summaryCounts.totalBySeverity.HIGH;
      case 'MEDIUM':
        return summaryCounts.totalBySeverity.MEDIUM;
      case 'LOW':
        return summaryCounts.totalBySeverity.LOW;
    }
  };

  const filteredAlerts = useMemo(() => {
    const matched = alerts.filter((item) => {
      const resolved = isAlertResolved(item);
      const sev = item.severity?.toUpperCase() || 'LOW';

      switch (filter) {
        case 'UNRESOLVED':
          return !resolved;
        case 'ALL':
          return true;
        case 'CRITICAL':
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW':
          return sev === filter;
      }
    });

    // Show unresolved items first, then newest createdAt first
    return [...matched].sort((a, b) => {
      const resolvedDiff = Number(isAlertResolved(a)) - Number(isAlertResolved(b));
      if (resolvedDiff !== 0) return resolvedDiff;
      const timeA = parseIsoDateTime(a.createdAt)?.getTime() ?? 0;
      const timeB = parseIsoDateTime(b.createdAt)?.getTime() ?? 0;
      return timeB - timeA;
    });
  }, [alerts, filter]);

  const toggleSeverityFilter = (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM') => {
    setFilter((prev) => (prev === severity ? 'UNRESOLVED' : severity));
  };

  const openAlertModal = (alertItem: CareAlertDto) => {
    setSelectedAlert(alertItem);
    setResolutionNote(sessionNotesByAlertId[alertItem.id] || '');
  };

  const closeAlertModal = () => {
    if (resolvingId !== null) return;
    setSelectedAlert(null);
    setResolutionNote('');
  };

  const handleConfirmResolve = async () => {
    if (!selectedAlert) return;
    const targetId = selectedAlert.id;
    const trimmedNote = resolutionNote.trim();

    try {
      setResolvingId(targetId);
      const res = await apiClient(`/api/alerts/${targetId}/resolve`, { method: 'PUT' });
      if (res.success) {
        if (trimmedNote) {
          setSessionNotesByAlertId((prev) => ({ ...prev, [targetId]: trimmedNote }));
        }

        const nowIso = new Date().toISOString();
        setRawAlerts((prev) =>
          prev.map((item) =>
            item.id === targetId
              ? { ...item, isResolved: true, resolved: true, resolvedAt: item.resolvedAt || nowIso }
              : item
          )
        );

        setSelectedAlert(null);
        setResolutionNote('');
        Alert.alert('Thành công', 'Đã đánh dấu xử lý cảnh báo này.');
        // Refresh silently to stay in sync with backend timestamps
        fetchAlerts(true);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật trạng thái cảnh báo.');
    } finally {
      setResolvingId(null);
    }
  };

  const renderSummaryCards = () => {
    const cards: Array<{
      key: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      label: string;
      count: number;
      bg: string;
      border: string;
      text: string;
      icon: keyof typeof Feather.glyphMap;
    }> = [
      {
        key: 'CRITICAL',
        label: 'Khẩn cấp',
        count: summaryCounts.CRITICAL,
        bg: colors.danger,
        border: colors.dangerBorder,
        text: colors.dangerText,
        icon: 'alert-octagon',
      },
      {
        key: 'HIGH',
        label: 'Mức cao',
        count: summaryCounts.HIGH,
        bg: colors.warning,
        border: colors.warningBorder,
        text: colors.warningText,
        icon: 'alert-triangle',
      },
      {
        key: 'MEDIUM',
        label: 'Trung bình',
        count: summaryCounts.MEDIUM,
        bg: colors.primaryLight,
        border: colors.borderLight,
        text: colors.primary,
        icon: 'info',
      },
    ];

    return (
      <View style={styles.summaryRow}>
        {cards.map((card) => {
          const isActive = filter === card.key;
          return (
            <TouchableOpacity
              key={card.key}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: card.bg,
                  borderColor: isActive ? card.text : card.border,
                  borderWidth: isActive ? 1.5 : 1,
                },
              ]}
              onPress={() => toggleSeverityFilter(card.key)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${card.label}: ${card.count} cảnh báo chưa xử lý`}
            >
              <View style={styles.summaryTopRow}>
                <Feather name={card.icon} size={14} color={card.text} />
                <Text
                  style={[styles.summaryCount, { color: card.text, fontSize: fs(20) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {card.count}
                </Text>
              </View>
              <Text
                style={[styles.summaryLabel, { color: card.text, fontSize: fs(11.5) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {card.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderFilterBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBarContent}
      style={styles.filterBarScroll}
    >
      {FILTER_CHIPS.map((chip) => {
        const isActive = filter === chip.key;
        const count = getChipCount(chip.key);
        return (
          <TouchableOpacity
            key={chip.key}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
            onPress={() => setFilter(chip.key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.filterChipText,
                { fontSize: fs(12.5) },
                isActive && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {chip.label} ({count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderAlertCard = (item: CareAlertDto) => {
    const resolved = isAlertResolved(item);
    const sev = getSeverityMeta(item.severity);
    const alertTitle = getAlertTitle(item.alertType, item.title);
    const elderlyLabel = item.elderlyName?.trim() || 'Người thân';
    const typeLabel = getAlertTypeLabel(item.alertType);

    return (
      <View
        key={item.id}
        style={[
          styles.alertCard,
          resolved && styles.alertCardResolved,
        ]}
      >
        {/* Row 1: Severity Badge + Timestamp */}
        <View style={styles.cardRow1}>
          <View
            style={[
              styles.sevBadge,
              { backgroundColor: sev.bg, borderColor: sev.border },
            ]}
          >
            <Text style={[styles.sevBadgeText, { color: sev.text, fontSize: fs(11.5) }]}>
              {sev.label}
            </Text>
          </View>
          <View style={styles.timeWrap}>
            <Feather name="clock" size={12} color={colors.textMuted} />
            <Text style={[styles.timeText, { fontSize: fs(12) }]}>
              {formatTimeHHMM(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Row 2: Alert Title */}
        <Text
          style={[
            styles.cardTitle,
            { fontSize: fs(16), lineHeight: Math.round(fs(16) * 1.35) },
          ]}
        >
          {alertTitle}
        </Text>

        {/* Row 3: Description */}
        <Text
          style={[
            styles.cardDesc,
            { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.42) },
          ]}
        >
          {formatConciseAlertDescription(item.description, elderlyLabel)}
        </Text>

        {/* Row 4: Metadata */}
        <View style={styles.cardMetaRow}>
          <Text
            style={[
              styles.cardMetaText,
              { fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.4) },
            ]}
          >
            {selectedElderlyId !== null
              ? `Loại: ${typeLabel} · ${resolved ? 'Đã xử lý' : 'Chưa xử lý'}`
              : `Người liên quan: ${elderlyLabel} • Loại: ${typeLabel} · ${
                  resolved ? 'Đã xử lý' : 'Chưa xử lý'
                }`}
          </Text>
        </View>

        {/* Row 5: Actions or Resolved State */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => openAlertModal(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Feather name="eye" size={14} color={colors.primary} />
            <Text
              style={[styles.detailBtnText, { fontSize: fs(13) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Xem chi tiết
            </Text>
          </TouchableOpacity>

          {!resolved ? (
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => openAlertModal(item)}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Feather name="check-circle" size={14} color={colors.textInverse} />
              <Text
                style={[styles.resolveBtnText, { fontSize: fs(13) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                Đã xử lý
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.resolvedPill}>
              <Feather name="check" size={13} color={colors.successText} />
              <Text
                style={[styles.resolvedPillText, { fontSize: fs(12) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {item.resolvedAt
                  ? `Đã xử lý • ${formatTimeHHMM(item.resolvedAt)}`
                  : 'Đã xử lý'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <CaregiverHeader
        title="Cảnh báo an toàn"
        subtitle={
          selectedElderlyName
            ? `Đang theo dõi: ${selectedElderlyName}`
            : 'Mimamori AI đang theo dõi và thông báo các vấn đề cần chú ý.'
        }
        lastUpdated={lastUpdated}
        onRefresh={() => fetchAlerts(true)}
        refreshing={refreshing}
      />

      {/* Summary & Filters */}
      <View style={styles.controlsSection}>
        {renderSummaryCards()}
        {renderFilterBar()}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>
            Đang tải danh sách cảnh báo...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAlerts(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Feather name="wifi-off" size={16} color={colors.dangerText} />
              <Text style={[styles.errorBannerText, { fontSize: fs(13) }]}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => fetchAlerts(false)} style={styles.retryLinkBtn}>
                <Text style={[styles.retryLinkText, { fontSize: fs(12.5) }]}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          )}

          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="shield" size={28} color={colors.successText} />
              </View>
              <Text style={[styles.emptyTitle, { fontSize: fs(18) }]}>Mọi thứ đang ổn</Text>
              <Text
                style={[
                  styles.emptySub,
                  { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.42) },
                ]}
              >
                Hiện chưa có cảnh báo nào cần xử lý.
              </Text>
              {filter !== 'ALL' && alerts.length > 0 && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => setFilter('ALL')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.showAllBtnText, { fontSize: fs(13) }]}>
                    Xem tất cả cảnh báo ({alerts.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredAlerts.map(renderAlertCard)
          )}
        </ScrollView>
      )}

      {/* Detail & Resolution Confirmation Modal / Bottom Sheet */}
      <Modal
        visible={selectedAlert !== null}
        transparent
        animationType="slide"
        onRequestClose={closeAlertModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeAlertModal}
          />

          {selectedAlert && (() => {
            const modalResolved = isAlertResolved(selectedAlert);
            const modalSev = getSeverityMeta(selectedAlert.severity);
            const modalTitle = getAlertTitle(selectedAlert.alertType, selectedAlert.title);
            const savedSessionNote = sessionNotesByAlertId[selectedAlert.id];

            return (
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeaderRow}>
                  <View
                    style={[
                      styles.sevBadge,
                      { backgroundColor: modalSev.bg, borderColor: modalSev.border },
                    ]}
                  >
                    <Text style={[styles.sevBadgeText, { color: modalSev.text, fontSize: fs(11.5) }]}>
                      {modalSev.label}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={closeAlertModal}
                    disabled={resolvingId !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng hộp thoại"
                  >
                    <Feather name="x" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      { fontSize: fs(19), lineHeight: Math.round(fs(19) * 1.32) },
                    ]}
                  >
                    {modalTitle}
                  </Text>

                  <View style={styles.modalMetaBlock}>
                    <View style={styles.modalMetaItem}>
                      <Feather name="user" size={14} color={colors.textSecondary} />
                      <Text style={[styles.modalMetaText, { fontSize: fs(13) }]}>
                        Người liên quan: {selectedAlert.elderlyName?.trim() || 'Người thân'}
                      </Text>
                    </View>
                    <View style={styles.modalMetaItem}>
                      <Feather name="tag" size={14} color={colors.textSecondary} />
                      <Text style={[styles.modalMetaText, { fontSize: fs(13) }]}>
                        Loại: {getAlertTypeLabel(selectedAlert.alertType)}
                      </Text>
                    </View>
                    <View style={styles.modalMetaItem}>
                      <Feather name="clock" size={14} color={colors.textSecondary} />
                      <Text style={[styles.modalMetaText, { fontSize: fs(13) }]}>
                        Thời gian: {formatTimeHHMM(selectedAlert.createdAt)} •{' '}
                        {formatFullDateVi(selectedAlert.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalDescBox}>
                    <Text style={[styles.modalDescLabel, { fontSize: fs(12) }]}>
                      Nội dung chi tiết
                    </Text>
                    <Text
                      style={[
                        styles.modalDescText,
                        { fontSize: fs(14), lineHeight: Math.round(fs(14) * 1.45) },
                      ]}
                    >
                      {selectedAlert.description}
                    </Text>
                  </View>

                  {!modalResolved ? (
                    <>
                      <View style={styles.confirmExplainBox}>
                        <Feather name="shield" size={16} color={colors.primary} />
                        <Text
                          style={[
                            styles.confirmExplainText,
                            { fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.42) },
                          ]}
                        >
                          Đánh dấu đã xử lý xác nhận bạn đã tiếp nhận kiểm tra cảnh báo này
                        </Text>
                      </View>

                      <View style={styles.noteInputWrap}>
                        <Text style={[styles.noteInputLabel, { fontSize: fs(12.5) }]}>
                          Ghi chú xử lý (tùy chọn)
                        </Text>
                        <TextInput
                          style={[styles.noteInput, { fontSize: fs(13.5) }]}
                          value={resolutionNote}
                          onChangeText={setResolutionNote}
                          placeholder="Ví dụ: Đã gọi điện hỏi thăm và nhắc người thân..."
                          placeholderTextColor={colors.textMuted}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                          editable={resolvingId === null}
                        />
                        <Text style={[styles.noteHintText, { fontSize: fs(11.5) }]}>
                          Ghi chú được lưu tạm trong phiên hiện tại để bạn dễ theo dõi.
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.modalResolvedBox}>
                      <View style={styles.modalResolvedHeader}>
                        <Feather name="check-circle" size={16} color={colors.successText} />
                        <Text style={[styles.modalResolvedTitle, { fontSize: fs(14) }]}>
                          Cảnh báo đã được xử lý
                        </Text>
                      </View>
                      {Boolean(selectedAlert.resolvedAt) && (
                        <Text style={[styles.modalResolvedSub, { fontSize: fs(12.5) }]}>
                          Thời điểm xác nhận: {formatTimeHHMM(selectedAlert.resolvedAt)} •{' '}
                          {formatFullDateVi(selectedAlert.resolvedAt)}
                        </Text>
                      )}
                      {Boolean(savedSessionNote) && (
                        <Text style={[styles.modalResolvedNote, { fontSize: fs(13) }]}>
                          Ghi chú của bạn: {savedSessionNote}
                        </Text>
                      )}
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalFooterRow}>
                  {!modalResolved ? (
                    <>
                      <TouchableOpacity
                        style={styles.modalCancelBtn}
                        onPress={closeAlertModal}
                        disabled={resolvingId !== null}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[styles.modalCancelText, { fontSize: fs(14) }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          Hủy
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalConfirmBtn}
                        onPress={handleConfirmResolve}
                        disabled={resolvingId === selectedAlert.id}
                        activeOpacity={0.8}
                      >
                        {resolvingId === selectedAlert.id ? (
                          <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                          <Text
                            style={[styles.modalConfirmText, { fontSize: fs(14) }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            Xác nhận đã xử lý
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.modalConfirmBtn}
                      onPress={closeAlertModal}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[styles.modalConfirmText, { fontSize: fs(14) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        Đóng
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}
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
  controlsSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    ...shadows.subtle,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  summaryCount: {
    fontWeight: '800',
    flexShrink: 1,
  },
  summaryLabel: {
    fontWeight: '700',
    flexShrink: 1,
  },
  filterBarScroll: {
    flexGrow: 0,
  },
  filterBarContent: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  filterChipTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 110,
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    flex: 1,
    minWidth: 0,
    color: colors.dangerText,
    fontWeight: '600',
    flexShrink: 1,
  },
  retryLinkBtn: {
    minHeight: 36,
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  retryLinkText: {
    color: colors.dangerText,
    fontWeight: '700',
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...shadows.subtle,
  },
  alertCardResolved: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.borderLight,
    opacity: 0.85,
  },
  cardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sevBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  sevBadgeText: {
    fontWeight: '800',
    flexShrink: 1,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  timeText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  cardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 22,
    flexShrink: 1,
  },
  cardDesc: {
    color: colors.textSecondary,
    lineHeight: 20,
    flexShrink: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  cardMetaText: {
    color: colors.textMuted,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 2,
  },
  detailBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  detailBtnText: {
    color: colors.primary,
    fontWeight: '700',
    flexShrink: 1,
  },
  resolveBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resolveBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
    flexShrink: 1,
  },
  resolvedPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  resolvedPillText: {
    color: colors.successText,
    fontWeight: '700',
    flexShrink: 1,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    paddingVertical: 32,
    paddingHorizontal: 22,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  showAllBtn: {
    marginTop: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  showAllBtnText: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(38, 51, 45, 0.42)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.elevated,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 26,
  },
  modalMetaBlock: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  modalMetaText: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalDescBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  modalDescLabel: {
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalDescText: {
    color: colors.textPrimary,
    lineHeight: 21,
  },
  confirmExplainBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  confirmExplainText: {
    flex: 1,
    minWidth: 0,
    color: colors.primaryDark,
    fontWeight: '600',
    lineHeight: 19,
    flexShrink: 1,
  },
  noteInputWrap: {
    gap: 6,
  },
  noteInputLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 78,
    color: colors.textPrimary,
  },
  noteHintText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  modalResolvedBox: {
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  modalResolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalResolvedTitle: {
    color: colors.successText,
    fontWeight: '800',
    flexShrink: 1,
  },
  modalResolvedSub: {
    color: colors.successText,
    fontWeight: '600',
  },
  modalResolvedNote: {
    color: colors.textPrimary,
    fontWeight: '500',
    marginTop: 2,
  },
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modalCancelBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
  },
  modalConfirmBtn: {
    flex: 1.7,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: colors.textInverse,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
