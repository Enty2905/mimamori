import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as lightColors, shadows } from '../../core/theme/colors';
import { useCaregiverTheme } from '../../core/theme/useTheme';
import { useCaregiverStore } from '../../core/caregiver/useCaregiverStore';
import { apiClient } from '../../core/api/client';
import {
  FamilyMemberDto,
  HealthConditionDto,
  MedicationDisplayStatusMeta,
  MedicationDto,
  MedicationLogDto,
  formatDateDisplayVi,
  formatDateKey,
  formatIsoDateToDisplay,
  formatTimeHHMM,
  getHealthConditionSeverityMeta,
  getHealthConditionStatusMeta,
  getMedicationDisplayStatus,
  parseIsoDateTime,
} from '../../core/utils/caregiverHelpers';
import { CaregiverHeader } from '../../components/caregiver/CaregiverHeader';
import { CaregiverMedicationFormModal } from '../../components/caregiver/CaregiverMedicationFormModal';
import { CaregiverConditionFormModal } from '../../components/caregiver/CaregiverConditionFormModal';
import {
  CaregiverRoutineModal,
  DailyRoutineOverviewDto,
  formatRoutineTimesSummary,
  getSleepStatusMeta,
} from '../../components/caregiver/CaregiverRoutineModal';
import { resolveWaterMetrics } from '../../core/routines/useCareRoutineStore';
import { EmptyState } from '../../components/EmptyState';

type MainTabMode = 'schedule' | 'prescriptions' | 'conditions';
type ScheduleSubMode = 'daily' | 'history';

const RECENT_DAYS_COUNT = 7;

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addLocalDays = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);

const pad2 = (value: number): string => String(value).padStart(2, '0');

const formatShortDateDDMM = (date: Date): string =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;

const formatFullDateDDMMYYYY = (date: Date): string =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

const getLogTimestamp = (log: MedicationLogDto): number => {
  const parsed = parseIsoDateTime(log.scheduledTime);
  return parsed ? parsed.getTime() : 0;
};

const getAdherenceAccentColor = (percent: number, totalCount: number, palette = lightColors): string => {
  if (totalCount === 0) return palette.textMuted;
  if (percent >= 80) return palette.successText;
  if (percent >= 50) return palette.warningText;
  return palette.dangerText;
};

export const CaregiverMedicationScreen: React.FC = () => {
  const { isDark, c: colors, fs } = useCaregiverTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const {
    selectedElderlyId,
    selectedElderlyName,
    setSelectedElderlyId,
    setSelectedElderlyName,
  } = useCaregiverStore();

  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLogDto[]>([]);
  const [historyLogs, setHistoryLogs] = useState<MedicationLogDto[]>([]);
  const [medications, setMedications] = useState<MedicationDto[]>([]);
  const [conditions, setConditions] = useState<HealthConditionDto[]>([]);

  const [mainTab, setMainTab] = useState<MainTabMode>('schedule');
  const [scheduleSubMode, setScheduleSubMode] = useState<ScheduleSubMode>('daily');
  const [todayDate, setTodayDate] = useState<Date>(() => startOfLocalDay(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfLocalDay(new Date()));
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const [medModalVisible, setMedModalVisible] = useState(false);
  const [editingMedication, setEditingMedication] = useState<MedicationDto | null>(null);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [editingCondition, setEditingCondition] = useState<HealthConditionDto | null>(null);
  const [routineOverview, setRoutineOverview] = useState<DailyRoutineOverviewDto | null>(null);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [deletingMedId, setDeletingMedId] = useState<number | null>(null);
  const [deletingCondId, setDeletingCondId] = useState<number | null>(null);

  const fetchSeqRef = useRef(0);

  const loadDataForElderly = useCallback(async (elderlyId: number) => {
    const reqId = ++fetchSeqRef.current;
    setErrorMessage(null);

    try {
      const [todayRes, historyRes, medsRes, condRes, routineRes] = await Promise.all([
        apiClient<MedicationLogDto[]>(`/api/medications/today?elderlyId=${elderlyId}`),
        apiClient<MedicationLogDto[]>(`/api/medications/history?elderlyId=${elderlyId}`),
        apiClient<MedicationDto[]>(`/api/medications?elderlyId=${elderlyId}`),
        apiClient<HealthConditionDto[]>(`/api/health-conditions?elderlyId=${elderlyId}`),
        apiClient<DailyRoutineOverviewDto>(`/api/routines/today?elderlyId=${elderlyId}`).catch(
          () => null
        ),
      ]);

      if (reqId !== fetchSeqRef.current) return;

      setTodayLogs(todayRes.success && Array.isArray(todayRes.data) ? todayRes.data : []);
      setHistoryLogs(historyRes.success && Array.isArray(historyRes.data) ? historyRes.data : []);
      setMedications(medsRes.success && Array.isArray(medsRes.data) ? medsRes.data : []);
      setConditions(condRes.success && Array.isArray(condRes.data) ? condRes.data : []);
      if (routineRes && routineRes.success && routineRes.data) {
        setRoutineOverview(routineRes.data);
      }

      const now = new Date();
      setTodayDate(startOfLocalDay(now));
      setLastUpdated(`Cập nhật ${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    } catch (err: any) {
      if (reqId !== fetchSeqRef.current) return;
      setErrorMessage(err?.message || 'Không thể tải dữ liệu thuốc và bệnh lý của người thân.');
    }
  }, []);

  const syncMembersAndData = useCallback(
    async (explicitTargetId?: number | null) => {
      setErrorMessage(null);
      try {
        const membersRes = await apiClient<FamilyMemberDto[]>('/api/family/members');
        const list =
          membersRes.success && Array.isArray(membersRes.data)
            ? membersRes.data.filter((item) => item.member?.role === 'ELDERLY')
            : [];
        setMembers(list);

        if (list.length === 0) {
          setSelectedElderlyId(null);
          setSelectedElderlyName(null);
          setTodayLogs([]);
          setHistoryLogs([]);
          setMedications([]);
          setConditions([]);
          setRoutineOverview(null);
          return;
        }

        const currentInStore = useCaregiverStore.getState().selectedElderlyId;
        const candidateId = explicitTargetId ?? currentInStore;
        const matched = list.find((m) => m.member.id === candidateId) ?? list[0];

        if (matched.member.id !== currentInStore) {
          setSelectedElderlyId(matched.member.id);
        }
        setSelectedElderlyName(matched.member.fullName);

        await loadDataForElderly(matched.member.id);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Không thể tải danh sách người thân.');
      } finally {
        setInitialLoading(false);
        setLoadingData(false);
        setRefreshing(false);
      }
    },
    [loadDataForElderly, setSelectedElderlyId, setSelectedElderlyName]
  );

  useEffect(() => {
    if (selectedElderlyId === null) {
      syncMembersAndData(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (members.length === 0) {
        await syncMembersAndData(selectedElderlyId);
        return;
      }
      if (!cancelled) {
        setLoadingData(true);
        await loadDataForElderly(selectedElderlyId);
        if (!cancelled) {
          setLoadingData(false);
          setInitialLoading(false);
        }
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [selectedElderlyId, loadDataForElderly, members.length, syncMembersAndData]);

  useEffect(() => {
    if (selectedElderlyId === null) return;
    const intervalId = setInterval(() => {
      loadDataForElderly(selectedElderlyId);
    }, 10000);
    return () => clearInterval(intervalId);
  }, [selectedElderlyId, loadDataForElderly]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncMembersAndData(selectedElderlyId);
  }, [syncMembersAndData, selectedElderlyId]);

  const selectedMember = useMemo(
    () => members.find((m) => m.member.id === selectedElderlyId) ?? null,
    [members, selectedElderlyId]
  );

  const activeElderlyName = selectedMember?.member?.fullName || selectedElderlyName || null;

  const today = todayDate;
  const todayKey = formatDateKey(today);
  const selectedDateKey = formatDateKey(selectedDate);
  const isTodaySelected = selectedDateKey === todayKey;
  // Scale the HH:mm rail width with font scale so "20:00" never wraps or clips at 130% fs()
  const timelineTimeWidth = Math.max(58, Math.ceil(fs(13) * 3.9));

  const recentDates = useMemo(() => {
    return Array.from({ length: RECENT_DAYS_COUNT }, (_, idx) => addLocalDays(today, -idx));
  }, [today]);

  const logCountByDateKey = useMemo(() => {
    const counts: Record<string, number> = {};
    counts[todayKey] = todayLogs.length;

    historyLogs.forEach((log) => {
      const parsed = parseIsoDateTime(log.scheduledTime);
      if (!parsed) return;
      const key = formatDateKey(parsed);
      if (key === todayKey) return;
      counts[key] = (counts[key] ?? 0) + 1;
    });

    return counts;
  }, [historyLogs, todayKey, todayLogs.length]);

  const scheduleLogsForSelectedDay = useMemo(() => {
    if (selectedDateKey === todayKey) {
      return [...todayLogs].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
    }

    return historyLogs
      .filter((log) => {
        const parsed = parseIsoDateTime(log.scheduledTime);
        return parsed ? formatDateKey(parsed) === selectedDateKey : false;
      })
      .sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
  }, [historyLogs, selectedDateKey, todayKey, todayLogs]);

  const sortedHistoryLogs = useMemo(() => {
    return [...historyLogs].sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a));
  }, [historyLogs]);

  const adherenceStats = useMemo(() => {
    const sourceLogs =
      scheduleSubMode === 'daily' ? scheduleLogsForSelectedDay : sortedHistoryLogs;
    const referenceNow = new Date();

    let takenCount = 0;
    let pendingCount = 0;
    let missedOrOverdueCount = 0;

    sourceLogs.forEach((log) => {
      const meta = getMedicationDisplayStatus(log, referenceNow, colors);
      if (meta.key === 'TAKEN') {
        takenCount += 1;
      } else if (meta.key === 'PENDING' || meta.key === 'UPCOMING') {
        pendingCount += 1;
      } else if (meta.key === 'OVERDUE' || meta.key === 'MISSED') {
        missedOrOverdueCount += 1;
      }
    });

    const totalCount = sourceLogs.length;
    const percent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

    return {
      totalCount,
      takenCount,
      pendingCount,
      missedOrOverdueCount,
      percent,
      accentColor: getAdherenceAccentColor(percent, totalCount, colors),
    };
  }, [scheduleLogsForSelectedDay, scheduleSubMode, sortedHistoryLogs, colors]);

  const conditionSummary = useMemo(() => {
    let monitoring = 0;
    let stable = 0;
    let worsening = 0;
    conditions.forEach((c) => {
      const st = c.status?.toUpperCase();
      if (st === 'STABLE' || st === 'RECOVERED') stable += 1;
      else if (st === 'WORSENING') worsening += 1;
      else monitoring += 1;
    });
    return { monitoring, stable, worsening, total: conditions.length };
  }, [conditions]);

  const handleStepDay = (delta: number) => {
    const next = addLocalDays(selectedDate, delta);
    if (formatDateKey(next) > todayKey) return;
    setSelectedDate(next);
  };

  const openCreateMedication = () => {
    setEditingMedication(null);
    setMedModalVisible(true);
  };

  const openEditMedication = (med: MedicationDto) => {
    setEditingMedication(med);
    setMedModalVisible(true);
  };

  const confirmStopMedication = (med: MedicationDto) => {
    Alert.alert(
      'Ngừng thuốc này?',
      `Bạn muốn ngừng lịch uống thuốc "${med.name}"? Lịch sử các cữ đã uống trước đây vẫn được giữ lại.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Ngừng thuốc',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingMedId(med.id);
              const res = await apiClient(`/api/medications/${med.id}`, { method: 'DELETE' });
              if (res.success && selectedElderlyId !== null) {
                await loadDataForElderly(selectedElderlyId);
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể ngừng thuốc.');
            } finally {
              setDeletingMedId(null);
            }
          },
        },
      ]
    );
  };

  const openCreateCondition = () => {
    setEditingCondition(null);
    setConditionModalVisible(true);
  };

  const openEditCondition = (cond: HealthConditionDto) => {
    setEditingCondition(cond);
    setConditionModalVisible(true);
  };

  const confirmDeleteCondition = (cond: HealthConditionDto) => {
    Alert.alert(
      'Xóa ghi nhận bệnh lý?',
      `Bạn có chắc muốn xóa mục "${cond.conditionName}" khỏi hồ sơ theo dõi?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingCondId(cond.id);
              const res = await apiClient(`/api/health-conditions/${cond.id}`, {
                method: 'DELETE',
              });
              if (res.success && selectedElderlyId !== null) {
                await loadDataForElderly(selectedElderlyId);
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa hồ sơ bệnh lý.');
            } finally {
              setDeletingCondId(null);
            }
          },
        },
      ]
    );
  };

  const renderStatusPill = (meta: MedicationDisplayStatusMeta) => (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: meta.bg,
          borderColor: meta.border,
        },
      ]}
    >
      <Feather name={meta.icon} size={12} color={meta.text} />
      <Text
        style={[styles.statusPillText, { color: meta.text, fontSize: fs(11.5) }]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </View>
  );

  const renderTimelineItem = (log: MedicationLogDto, index: number, total: number) => {
    const displayStatus = getMedicationDisplayStatus(log, new Date(), colors);
    const isLast = index === total - 1;
    const dotColor =
      displayStatus.key === 'TAKEN'
        ? colors.successText
        : displayStatus.key === 'OVERDUE' || displayStatus.key === 'MISSED'
          ? colors.dangerText
          : displayStatus.key === 'PENDING'
            ? colors.warningText
            : colors.textMuted;

    const noteText = log.notes?.trim();

    return (
      <View key={`${log.id}-${log.scheduledTime}`} style={styles.timelineRow}>
        <View style={styles.timelineRail}>
          <Text
            style={[styles.timelineTime, { fontSize: fs(13), width: timelineTimeWidth }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {formatTimeHHMM(log.scheduledTime)}
          </Text>
          <View style={styles.timelineTrackWrap}>
            <View
              style={[
                styles.timelineDotOuter,
                { borderColor: displayStatus.border, backgroundColor: displayStatus.bg },
              ]}
            >
              <View style={[styles.timelineDotInner, { backgroundColor: dotColor }]} />
            </View>
            {!isLast && <View style={styles.timelineLine} />}
          </View>
        </View>

        <View style={[styles.timelineCard, !isLast && styles.timelineCardSpacing]}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.medDosageTop, { fontSize: fs(13) }]}>
              Liều lượng: {log.dosage}
            </Text>
            {renderStatusPill(displayStatus)}
          </View>

          <View style={styles.medMainRow}>
            <MaterialCommunityIcons
              name="pill"
              size={16}
              color={colors.primary}
              style={styles.medIcon}
            />
            <Text style={[styles.medName, styles.medNameFlex, { fontSize: fs(15.5) }]}>
              {log.medicationName}
            </Text>
          </View>

          {log.status === 'TAKEN' && Boolean(log.takenTime) && (
            <View style={styles.takenMetaRow}>
              <Feather name="check" size={13} color={colors.successText} />
              <Text style={[styles.takenMetaText, { fontSize: fs(12) }]}>
                Đã xác nhận uống lúc {formatTimeHHMM(log.takenTime)}
              </Text>
            </View>
          )}

          {Boolean(noteText) && (
            <View style={styles.noteBox}>
              <Feather name="file-text" size={13} color={colors.textSecondary} style={styles.noteIcon} />
              <Text style={[styles.noteText, { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.44) }]}>
                {noteText}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHistoryItem = (log: MedicationLogDto) => {
    const displayStatus = getMedicationDisplayStatus(log, new Date(), colors);
    const parsedDate = parseIsoDateTime(log.scheduledTime);
    const dateLabel = parsedDate ? formatDateDisplayVi(parsedDate) : '--/--';
    const timeLabel = formatTimeHHMM(log.scheduledTime);
    const noteText = log.notes?.trim();

    return (
      <View key={`hist-${log.id}-${log.scheduledTime}`} style={styles.historyCard}>
        <View style={styles.historyTopRow}>
          <View style={styles.historyDateBadge}>
            <Feather name="calendar" size={12} color={colors.primary} />
            <Text style={[styles.historyDateText, { fontSize: fs(12) }]}>
              {dateLabel} • {timeLabel}
            </Text>
          </View>
          {renderStatusPill(displayStatus)}
        </View>

        <View style={styles.historyBody}>
          <View style={styles.historyMedRow}>
            <MaterialCommunityIcons
              name="pill"
              size={16}
              color={colors.primary}
              style={styles.medIcon}
            />
            <Text style={[styles.medName, styles.medNameFlex, { fontSize: fs(15.5) }]}>
              {log.medicationName}
            </Text>
          </View>
          <Text style={[styles.medDosage, { fontSize: fs(13) }]}>Liều lượng: {log.dosage}</Text>

          {log.status === 'TAKEN' && Boolean(log.takenTime) && (
            <View style={styles.takenMetaRow}>
              <Feather name="check" size={13} color={colors.successText} />
              <Text style={[styles.takenMetaText, { fontSize: fs(12) }]}>
                Uống lúc {formatTimeHHMM(log.takenTime)}
              </Text>
            </View>
          )}

          {Boolean(noteText) && (
            <View style={styles.noteBox}>
              <Feather name="file-text" size={13} color={colors.textSecondary} style={styles.noteIcon} />
              <Text style={[styles.noteText, { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.44) }]}>
                {noteText}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPrescriptionCard = (med: MedicationDto) => {
    const times = Array.from(
      new Set((med.schedules || []).map((s) => formatTimeHHMM(s.reminderTime)).filter((t) => t !== '--:--'))
    ).sort();
    const isDeleting = deletingMedId === med.id;

    return (
      <View key={med.id} style={styles.recordCard}>
        <View style={styles.recordCardHeader}>
          <View style={styles.recordTitleRow}>
            <View style={styles.medBadgeCircle}>
              <MaterialCommunityIcons name="pill" size={17} color={colors.primaryDark} />
            </View>
            <View style={styles.recordTitleCol}>
              <Text style={[styles.medName, { fontSize: fs(16) }]}>{med.name}</Text>
              <Text style={[styles.medDosage, { fontSize: fs(13) }]}>
                Liều lượng: {med.dosage}
              </Text>
            </View>
          </View>
          <View style={styles.activeDrugBadge}>
            <Text style={[styles.activeDrugBadgeText, { fontSize: fs(11.5) }]}>Đang dùng</Text>
          </View>
        </View>

        {times.length > 0 && (
          <View style={styles.timesChipRow}>
            {times.map((t) => (
              <View key={t} style={styles.timeChip}>
                <Feather name="clock" size={12} color={colors.primaryDark} />
                <Text style={[styles.timeChipText, { fontSize: fs(12) }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {Boolean(med.instructions?.trim()) && (
          <View style={styles.noteBox}>
            <Feather name="info" size={13} color={colors.primary} style={styles.noteIcon} />
            <Text style={[styles.noteText, { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.44) }]}>
              Hướng dẫn: {med.instructions?.trim()}
            </Text>
          </View>
        )}

        <Text style={[styles.recordDateMeta, { fontSize: fs(12) }]}>
          Từ {formatIsoDateToDisplay(med.startDate)}
          {med.endDate ? ` → ${formatIsoDateToDisplay(med.endDate)}` : ' · Duy trì hằng ngày'}
        </Text>

        <View style={styles.cardActionRow}>
          <TouchableOpacity
            style={styles.cardSecondaryBtn}
            onPress={() => openEditMedication(med)}
            disabled={isDeleting}
          >
            <Feather name="edit-2" size={14} color={colors.primaryDark} />
            <Text
              style={[styles.cardSecondaryBtnText, { fontSize: fs(13) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              Chỉnh sửa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardDangerBtn, isDeleting && styles.btnDisabled]}
            onPress={() => confirmStopMedication(med)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.dangerText} />
            ) : (
              <>
                <Feather name="slash" size={14} color={colors.dangerText} />
                <Text
                  style={[styles.cardDangerBtnText, { fontSize: fs(13) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  Ngừng thuốc
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderConditionCard = (cond: HealthConditionDto) => {
    const statusMeta = getHealthConditionStatusMeta(cond.status, colors);
    const severityMeta = getHealthConditionSeverityMeta(cond.severity, colors);
    const isDeleting = deletingCondId === cond.id;

    return (
      <View key={cond.id} style={styles.recordCard}>
        <View style={styles.conditionBadgeRow}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
            ]}
          >
            <Feather name={statusMeta.icon} size={12} color={statusMeta.text} />
            <Text style={[styles.statusPillText, { color: statusMeta.text, fontSize: fs(11.5) }]}>
              {statusMeta.label}
            </Text>
          </View>

          <View
            style={[
              styles.severityPill,
              { backgroundColor: severityMeta.bg, borderColor: severityMeta.border },
            ]}
          >
            <Text style={[styles.severityPillText, { color: severityMeta.text, fontSize: fs(11.5) }]}>
              {severityMeta.label}
            </Text>
          </View>

          <Text style={[styles.conditionDateText, { fontSize: fs(12) }]}>
            {formatIsoDateToDisplay(cond.recordDate)}
          </Text>
        </View>

        <Text style={[styles.conditionTitle, { fontSize: fs(16.5) }]}>
          {cond.conditionName}
        </Text>

        {Boolean(cond.doctorOrClinic?.trim()) && (
          <View style={styles.clinicMetaRow}>
            <Feather name="map-pin" size={13} color={colors.textSecondary} />
            <Text style={[styles.clinicMetaText, { fontSize: fs(12.5) }]}>
              {cond.doctorOrClinic?.trim()}
            </Text>
          </View>
        )}

        {Boolean(cond.symptomsOrNotes?.trim()) && (
          <View style={styles.noteBox}>
            <Feather name="file-text" size={13} color={colors.textSecondary} style={styles.noteIcon} />
            <Text style={[styles.noteText, { fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.42) }]}>
              {cond.symptomsOrNotes?.trim()}
            </Text>
          </View>
        )}

        {Boolean(cond.nextCheckupDate) && (
          <View style={styles.nextCheckupPill}>
            <Feather name="calendar" size={13} color={colors.primaryDark} />
            <Text style={[styles.nextCheckupText, { fontSize: fs(12.5) }]}>
              Hẹn tái khám: {formatIsoDateToDisplay(cond.nextCheckupDate)}
            </Text>
          </View>
        )}

        <View style={styles.cardActionRow}>
          <TouchableOpacity
            style={[styles.cardSecondaryBtn, styles.cardActionPrimaryWide]}
            onPress={() => openEditCondition(cond)}
            disabled={isDeleting}
          >
            <Feather name="refresh-cw" size={14} color={colors.primaryDark} />
            <Text
              style={[styles.cardSecondaryBtnText, { fontSize: fs(13) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              Cập nhật tái khám
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardDangerBtn, isDeleting && styles.btnDisabled]}
            onPress={() => confirmDeleteCondition(cond)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.dangerText} />
            ) : (
              <>
                <Feather name="trash-2" size={14} color={colors.dangerText} />
                <Text
                  style={[styles.cardDangerBtnText, { fontSize: fs(13) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  Xóa
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <CaregiverHeader
        title="Thuốc & Bệnh lý"
        subtitle={
          activeElderlyName
            ? `Đang theo dõi: ${activeElderlyName}`
            : 'Quản lý đơn thuốc, lịch uống và diễn biến bệnh lý.'
        }
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      {initialLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerStateText, { fontSize: fs(14) }]}>
            Đang tải dữ liệu thuốc và bệnh lý...
          </Text>
        </View>
      ) : members.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        >
          <EmptyState
            vectorIcon="users"
            title="Chưa có người thân liên kết"
            description="Hãy liên kết tài khoản người cao tuổi tại mục Gia đình để theo dõi lịch uống thuốc và bệnh lý."
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        >
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={colors.dangerText} />
              <Text style={[styles.errorBannerText, { fontSize: fs(13) }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Top 3-tab Switcher: Lịch uống | Đơn thuốc | Bệnh lý */}
          <View style={styles.switcherContainer}>
            <TouchableOpacity
              style={[styles.switcherTab, mainTab === 'schedule' && styles.switcherTabActive]}
              onPress={() => setMainTab('schedule')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: mainTab === 'schedule' }}
            >
              <Feather
                name="clock"
                size={15}
                color={mainTab === 'schedule' ? colors.primaryDark : colors.textSecondary}
              />
              <Text
                style={[
                  styles.switcherText,
                  { fontSize: fs(12) },
                  mainTab === 'schedule' && styles.switcherTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                Lịch uống
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.switcherTab, mainTab === 'prescriptions' && styles.switcherTabActive]}
              onPress={() => setMainTab('prescriptions')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: mainTab === 'prescriptions' }}
            >
              <MaterialCommunityIcons
                name="pill"
                size={16}
                color={mainTab === 'prescriptions' ? colors.primaryDark : colors.textSecondary}
              />
              <Text
                style={[
                  styles.switcherText,
                  { fontSize: fs(12) },
                  mainTab === 'prescriptions' && styles.switcherTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                Đơn thuốc ({medications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.switcherTab, mainTab === 'conditions' && styles.switcherTabActive]}
              onPress={() => setMainTab('conditions')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: mainTab === 'conditions' }}
            >
              <Feather
                name="activity"
                size={15}
                color={mainTab === 'conditions' ? colors.primaryDark : colors.textSecondary}
              />
              <Text
                style={[
                  styles.switcherText,
                  { fontSize: fs(12) },
                  mainTab === 'conditions' && styles.switcherTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                Bệnh lý ({conditions.length})
              </Text>
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.centerStateText, { fontSize: fs(13.5) }]}>
                Đang đồng bộ dữ liệu...
              </Text>
            </View>
          ) : mainTab === 'schedule' ? (
            <>
              {/* Adherence Overview Card */}
              <View style={styles.adherenceCard}>
                <View style={styles.adherenceHeader}>
                  <View style={styles.adherenceTitleWrap}>
                    <Text style={[styles.adherenceKicker, { fontSize: fs(11.5) }]}>
                      {scheduleSubMode === 'daily'
                        ? `TUÂN THỦ • ${formatDateDisplayVi(selectedDate).toUpperCase()}`
                        : `LỊCH SỬ (${adherenceStats.totalCount} CỮ GẦN NHẤT)`}
                    </Text>
                    <Text style={[styles.adherenceSub, { fontSize: fs(13.5) }]}>
                      {adherenceStats.takenCount}/{adherenceStats.totalCount} cữ đã uống
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.adherencePercent,
                      { fontSize: fs(30), color: adherenceStats.accentColor },
                    ]}
                  >
                    {adherenceStats.totalCount > 0 ? `${adherenceStats.percent}%` : '—'}
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${adherenceStats.totalCount > 0 ? adherenceStats.percent : 0}%`,
                        backgroundColor: adherenceStats.accentColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.statPillsRow}>
                  <View style={[styles.statPill, styles.statPillSuccess]}>
                    <View style={[styles.statDot, { backgroundColor: colors.successText }]} />
                    <Text style={[styles.statPillLabel, { color: colors.successText, fontSize: fs(12) }]}>
                      Đã uống: {adherenceStats.takenCount}
                    </Text>
                  </View>

                  <View style={[styles.statPill, styles.statPillWarning]}>
                    <View style={[styles.statDot, { backgroundColor: colors.warningText }]} />
                    <Text style={[styles.statPillLabel, { color: colors.warningText, fontSize: fs(12) }]}>
                      Chờ uống: {adherenceStats.pendingCount}
                    </Text>
                  </View>

                  <View style={[styles.statPill, styles.statPillDanger]}>
                    <View style={[styles.statDot, { backgroundColor: colors.dangerText }]} />
                    <Text style={[styles.statPillLabel, { color: colors.dangerText, fontSize: fs(12) }]}>
                      Quá giờ / Bỏ lỡ: {adherenceStats.missedOrOverdueCount}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Daily Routine (Water & Sleep) Summary Card */}
              {(() => {
                const water = resolveWaterMetrics(routineOverview);
                const waterTimesText = formatRoutineTimesSummary(
                  routineOverview?.waterReminderTimes,
                  routineOverview?.waterEnabled ?? true
                );
                const sleepMeta = getSleepStatusMeta(routineOverview, colors);
                const bedtimeStr = routineOverview?.bedtimeTime || '21:30';
                const wakeupStr = routineOverview?.wakeupTime || '06:00';

                return (
                  <View style={styles.routineSummaryCard}>
                    <View style={styles.routineCardHeader}>
                      <View style={styles.routineTitleWrap}>
                        <Feather name="sun" size={17} color={colors.primary} />
                        <Text style={[styles.routineCardTitle, { fontSize: fs(15) }]}>
                          Lịch Nước uống & Giấc ngủ
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.routineSetupBtn}
                        onPress={() => setRoutineModalVisible(true)}
                        activeOpacity={0.8}
                      >
                        <Feather name="sliders" size={13} color={colors.primaryDark} />
                        <Text style={[styles.routineSetupBtnText, { fontSize: fs(12.5) }]}>
                          Thiết lập
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.routineItemBox}>
                      <View style={styles.routineItemTopRow}>
                        <View style={styles.routineItemLabelRow}>
                          <Feather
                            name="droplet"
                            size={14}
                            color={isDark ? colors.textSecondary : '#0284C7'}
                          />
                          <Text style={[styles.routineItemLabel, { fontSize: fs(13.5) }]}>
                            Nước lọc ({water.cupMl}ml/ly)
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.routineWaterValue,
                            { fontSize: fs(13.5), color: isDark ? colors.textPrimary : '#0369A1' },
                          ]}
                        >
                          {water.completedLitersLabel} / {water.targetLitersLabel} L ({water.completedCups}/{water.targetCups} ly)
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.routineProgressTrack,
                          { backgroundColor: isDark ? colors.surfaceMuted : '#E0F2FE' },
                        ]}
                      >
                        <View
                          style={[
                            styles.routineProgressFill,
                            {
                              width: `${water.percent}%`,
                              backgroundColor: isDark ? colors.primary : '#0EA5E9',
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.routineSubMeta,
                          {
                            fontSize: fs(12),
                            color: isDark ? colors.textSecondary : '#0369A1',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        Đánh giá ngày: {water.evaluationText}
                      </Text>
                      <Text style={[styles.routineSubMeta, { fontSize: fs(12) }]}>
                        Giờ nhắc: {waterTimesText}
                      </Text>
                    </View>

                    <View style={styles.routineItemDivider} />

                    <View style={styles.routineItemBox}>
                      <View style={styles.routineItemTopRow}>
                        <View style={styles.routineItemLabelRow}>
                          <Feather name="moon" size={14} color={colors.accentDark} />
                          <Text style={[styles.routineItemLabel, { fontSize: fs(13.5) }]}>
                            Giấc ngủ
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.routineSleepBadge,
                            {
                              backgroundColor: sleepMeta.bg,
                              borderColor: sleepMeta.border,
                            },
                          ]}
                        >
                          <Feather name={sleepMeta.icon} size={12} color={sleepMeta.text} />
                          <Text
                            style={[
                              styles.routineSleepBadgeText,
                              { color: sleepMeta.text, fontSize: fs(11.5) },
                            ]}
                          >
                            {sleepMeta.badgeLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.routineSubMeta, { fontSize: fs(12.5) }]}>
                        Đi ngủ {bedtimeStr} • Dậy {wakeupStr}
                        {routineOverview?.sleepEnabled === false ? ' (Đang tắt nhắc)' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Sub-mode Toggle: Theo ngày | Lịch sử */}
              <View style={styles.subModeRow}>
                <TouchableOpacity
                  style={[styles.subModeChip, scheduleSubMode === 'daily' && styles.subModeChipActive]}
                  onPress={() => setScheduleSubMode('daily')}
                >
                  <Text
                    style={[
                      styles.subModeChipText,
                      { fontSize: fs(12.5) },
                      scheduleSubMode === 'daily' && styles.subModeChipTextActive,
                    ]}
                  >
                    Lịch theo ngày
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subModeChip, scheduleSubMode === 'history' && styles.subModeChipActive]}
                  onPress={() => setScheduleSubMode('history')}
                >
                  <Text
                    style={[
                      styles.subModeChipText,
                      { fontSize: fs(12.5) },
                      scheduleSubMode === 'history' && styles.subModeChipTextActive,
                    ]}
                  >
                    Nhật ký đã uống ({sortedHistoryLogs.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduleSubMode === 'daily' ? (
                <>
                  {/* Fixed-width Date Selector Bar so "Hôm nay" never truncates */}
                  <View style={styles.dayBar}>
                    <TouchableOpacity
                      style={styles.dayStepBtn}
                      onPress={() => handleStepDay(-1)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Ngày trước"
                    >
                      <Feather name="chevron-left" size={16} color={colors.primary} />
                      <Text
                        style={[styles.dayStepText, { fontSize: fs(12.5) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Trước
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dayCenterBtn}
                      onPress={() => setDateModalVisible(true)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Chọn nhanh ngày trong 7 ngày gần đây"
                    >
                      <Feather name="calendar" size={14} color={colors.primary} />
                      <Text
                        style={[styles.dayCenterText, { fontSize: fs(13) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                      >
                        {formatDateDisplayVi(selectedDate)}
                      </Text>
                      <Feather name="chevron-down" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dayStepBtn, isTodaySelected && styles.dayStepBtnDisabled]}
                      onPress={() => handleStepDay(1)}
                      disabled={isTodaySelected}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Ngày sau"
                    >
                      <Text
                        style={[
                          styles.dayStepText,
                          { fontSize: fs(12.5) },
                          isTodaySelected && styles.dayStepTextDisabled,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Sau
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={isTodaySelected ? colors.textMuted : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionTitle, { fontSize: fs(16) }]}>
                        Chi tiết cữ thuốc ({scheduleLogsForSelectedDay.length})
                      </Text>
                      <View style={styles.sectionActionsRight}>
                        {!isTodaySelected && (
                          <TouchableOpacity
                            style={styles.jumpTodayChip}
                            onPress={() => setSelectedDate(today)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.jumpTodayText, { fontSize: fs(12) }]}>
                              Về hôm nay
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.quickAddChip}
                          onPress={openCreateMedication}
                          activeOpacity={0.8}
                        >
                          <Feather name="plus" size={13} color={colors.textInverse} />
                          <Text style={[styles.quickAddChipText, { fontSize: fs(12.5) }]}>
                            Thêm thuốc
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {scheduleLogsForSelectedDay.length === 0 ? (
                      <EmptyState
                        vectorIcon="calendar"
                        title="Chưa có lịch thuốc"
                        description="Chưa có cữ thuốc nào cho ngày này. Nhấn 'Thêm thuốc' để kê đơn mới."
                      />
                    ) : (
                      <View style={styles.timelineList}>
                        {scheduleLogsForSelectedDay.map((log, idx) =>
                          renderTimelineItem(log, idx, scheduleLogsForSelectedDay.length)
                        )}
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { fontSize: fs(16) }]}>
                      Nhật ký uống thuốc gần đây ({sortedHistoryLogs.length})
                    </Text>
                  </View>

                  {sortedHistoryLogs.length === 0 ? (
                    <EmptyState
                      vectorIcon="clock"
                      title="Chưa có lịch sử"
                      description="Chưa có lịch sử uống thuốc được ghi nhận cho người thân này."
                    />
                  ) : (
                    <View style={styles.historyList}>
                      {sortedHistoryLogs.map((log) => renderHistoryItem(log))}
                    </View>
                  )}
                </View>
              )}
            </>
          ) : mainTab === 'prescriptions' ? (
            <View style={styles.sectionBlock}>
              <View style={styles.bannerActionCard}>
                <View style={styles.bannerActionInfo}>
                  <Text style={[styles.bannerActionTitle, { fontSize: fs(16) }]}>
                    Đơn thuốc đang dùng ({medications.length})
                  </Text>
                  <Text
                    style={[
                      styles.bannerActionDesc,
                      { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.44) },
                    ]}
                  >
                    Thêm thuốc mới sau mỗi lần đi khám hoặc điều chỉnh liều lượng khi tái khám.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryCtaBtn}
                  onPress={openCreateMedication}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={16} color={colors.textInverse} />
                  <Text style={[styles.primaryCtaBtnText, { fontSize: fs(14) }]}>
                    Thêm thuốc mới
                  </Text>
                </TouchableOpacity>
              </View>

              {medications.length === 0 ? (
                <EmptyState
                  vectorIcon="plus-circle"
                  title="Chưa có đơn thuốc nào"
                  description="Hãy thêm các loại thuốc bác sĩ đã kê đơn để hệ thống tự động nhắc giờ uống hằng ngày."
                />
              ) : (
                <View style={styles.cardsColumn}>
                  {medications.map((med) => renderPrescriptionCard(med))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <View style={styles.bannerActionCard}>
                <View style={styles.bannerActionInfo}>
                  <Text style={[styles.bannerActionTitle, { fontSize: fs(16) }]}>
                    Theo dõi bệnh lý & Tái khám ({conditionSummary.total})
                  </Text>
                  <Text
                    style={[
                      styles.bannerActionDesc,
                      { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.44) },
                    ]}
                  >
                    Ghi chú bệnh nền, diễn biến sau mỗi lần đi khám và lịch hẹn bác sĩ tiếp theo.
                  </Text>
                  {conditionSummary.total > 0 && (
                    <View style={styles.conditionStatsRow}>
                      <View style={[styles.miniPill, styles.statPillWarning]}>
                        <Text style={[styles.miniPillText, { color: colors.warningText, fontSize: fs(11.5) }]}>
                          Theo dõi: {conditionSummary.monitoring}
                        </Text>
                      </View>
                      <View style={[styles.miniPill, styles.statPillSuccess]}>
                        <Text style={[styles.miniPillText, { color: colors.successText, fontSize: fs(11.5) }]}>
                          Ổn định: {conditionSummary.stable}
                        </Text>
                      </View>
                      {conditionSummary.worsening > 0 && (
                        <View style={[styles.miniPill, styles.statPillDanger]}>
                          <Text style={[styles.miniPillText, { color: colors.dangerText, fontSize: fs(11.5) }]}>
                            Lưu ý nặng: {conditionSummary.worsening}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.primaryCtaBtn}
                  onPress={openCreateCondition}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={16} color={colors.textInverse} />
                  <Text style={[styles.primaryCtaBtnText, { fontSize: fs(14) }]}>
                    Ghi nhận bệnh lý / Tái khám
                  </Text>
                </TouchableOpacity>
              </View>

              {conditions.length === 0 ? (
                <EmptyState
                  vectorIcon="activity"
                  title="Chưa có ghi nhận bệnh lý"
                  description="Lưu bệnh nền và ghi chú kết quả mỗi lần đi khám để cả gia đình dễ dàng nắm bắt tình hình."
                />
              ) : (
                <View style={styles.cardsColumn}>
                  {conditions.map((cond) => renderConditionCard(cond))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Quick 7-Day Date Picker Modal */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDateModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleCol}>
                <Text style={[styles.modalTitle, { fontSize: fs(17) }]}>Chọn ngày theo dõi</Text>
                <Text style={[styles.modalSubtitle, { fontSize: fs(12.5) }]}>
                  7 ngày gần đây • Dữ liệu thực tế từ hệ thống
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDateModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng chọn ngày"
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalJumpTodayBtn}
              onPress={() => {
                setSelectedDate(today);
                setDateModalVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Feather name="navigation" size={15} color={colors.primaryDark} />
              <Text style={[styles.modalJumpTodayText, { fontSize: fs(13.5) }]}>
                Chuyển nhanh về Hôm nay ({formatShortDateDDMM(today)})
              </Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalDateList}>
              {recentDates.map((d) => {
                const dKey = formatDateKey(d);
                const isSelected = dKey === selectedDateKey;
                const count = logCountByDateKey[dKey] ?? 0;

                return (
                  <TouchableOpacity
                    key={dKey}
                    style={[styles.modalDateItem, isSelected && styles.modalDateItemActive]}
                    onPress={() => {
                      setSelectedDate(d);
                      setDateModalVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.modalDateLeft}>
                      <Text
                        style={[
                          styles.modalDatePrimary,
                          { fontSize: fs(14) },
                          isSelected && styles.modalDatePrimaryActive,
                        ]}
                      >
                        {formatDateDisplayVi(d)}
                      </Text>
                      <Text style={[styles.modalDateSecondary, { fontSize: fs(12) }]}>
                        {formatFullDateDDMMYYYY(d)}
                      </Text>
                    </View>

                    <View style={styles.modalDateRight}>
                      <Text
                        style={[
                          styles.modalDateCount,
                          { fontSize: fs(12) },
                          count === 0 && styles.modalDateCountEmpty,
                        ]}
                      >
                        {count > 0 ? `${count} cữ` : 'Không có'}
                      </Text>
                      {isSelected && <Feather name="check-circle" size={16} color={colors.primary} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Medication Create / Edit Modal */}
      {selectedElderlyId !== null && (
        <CaregiverMedicationFormModal
          visible={medModalVisible}
          elderlyId={selectedElderlyId}
          elderlyName={activeElderlyName}
          editingMedication={editingMedication}
          onClose={() => {
            setMedModalVisible(false);
            setEditingMedication(null);
          }}
          onSaved={() => loadDataForElderly(selectedElderlyId)}
        />
      )}

      {/* Health Condition Create / Follow-up Update Modal */}
      {selectedElderlyId !== null && (
        <CaregiverConditionFormModal
          visible={conditionModalVisible}
          elderlyId={selectedElderlyId}
          elderlyName={activeElderlyName}
          editingCondition={editingCondition}
          onClose={() => {
            setConditionModalVisible(false);
            setEditingCondition(null);
          }}
          onSaved={() => loadDataForElderly(selectedElderlyId)}
        />
      )}

      {/* Care Routine (Water & Sleep) Config Modal */}
      {selectedElderlyId !== null && (
        <CaregiverRoutineModal
          visible={routineModalVisible}
          elderlyId={selectedElderlyId}
          elderlyName={activeElderlyName}
          initialRoutine={routineOverview}
          onClose={() => setRoutineModalVisible(false)}
          onSaved={(updated) => {
            if (updated) {
              setRoutineOverview(updated);
            }
            loadDataForElderly(selectedElderlyId);
          }}
        />
      )}
    </View>
  );
};

const createStyles = (colors: typeof lightColors, isDark: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  centerStateText: {
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  inlineLoading: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: colors.dangerText,
    fontWeight: '600',
  },
  switcherContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  switcherTab: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  switcherTabActive: {
    backgroundColor: isDark ? colors.surfaceMuted : colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.border } : {}),
    ...shadows.subtle,
  },
  switcherText: {
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'center',
  },
  switcherTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  adherenceCard: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  adherenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  adherenceTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  adherenceKicker: {
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  adherenceSub: {
    marginTop: 3,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  adherencePercent: {
    fontWeight: '900',
    flexShrink: 0,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceWarm,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 1,
  },
  statPillSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.successBorder,
  },
  statPillWarning: {
    backgroundColor: colors.warning,
    borderColor: colors.warningBorder,
  },
  statPillDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerBorder,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  statPillLabel: {
    fontWeight: '700',
    flexShrink: 1,
  },
  subModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 18,
    marginBottom: 12,
    gap: 8,
  },
  subModeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  subModeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  subModeChipText: {
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  subModeChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.subtle,
  },
  dayStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    flexShrink: 0,
  },
  dayStepBtnDisabled: {
    opacity: 0.45,
  },
  dayStepText: {
    fontWeight: '700',
    color: colors.primary,
  },
  dayStepTextDisabled: {
    color: colors.textMuted,
  },
  dayCenterBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  dayCenterText: {
    fontWeight: '800',
    color: colors.primaryDark,
    flexShrink: 1,
    textAlign: 'center',
  },
  sectionBlock: {
    paddingHorizontal: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    rowGap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 145,
  },
  sectionActionsRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  jumpTodayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  jumpTodayText: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  quickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  quickAddChipText: {
    fontWeight: '800',
    color: colors.textInverse,
  },
  timelineList: {
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 14,
    paddingRight: 8,
    gap: 6,
    flexShrink: 0,
  },
  timelineTime: {
    minWidth: 56,
    flexShrink: 0,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  timelineTrackWrap: {
    width: 16,
    alignItems: 'center',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  timelineDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
    marginBottom: -14,
  },
  timelineCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  timelineCardSpacing: {
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    rowGap: 6,
  },
  medDosageTop: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 105,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  medMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  historyMedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  medIcon: {
    marginTop: 2,
    marginRight: 8,
    flexShrink: 0,
  },
  medName: {
    flexShrink: 1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  medNameFlex: {
    flex: 1,
    minWidth: 0,
  },
  medDosage: {
    marginTop: 3,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
    maxWidth: '100%',
  },
  statusPillText: {
    fontWeight: '700',
    flexShrink: 1,
  },
  takenMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  takenMetaText: {
    color: colors.successText,
    fontWeight: '600',
    flexShrink: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceWarm,
  },
  noteIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  noteText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: colors.textPrimary,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  historyTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    rowGap: 6,
    marginBottom: 10,
  },
  historyDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    flexShrink: 1,
    minWidth: 0,
  },
  historyDateText: {
    fontWeight: '700',
    color: colors.primaryDark,
    flexShrink: 1,
  },
  historyBody: {
    minWidth: 0,
  },
  bannerActionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
    ...shadows.card,
  },
  bannerActionInfo: {
    gap: 4,
  },
  bannerActionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  bannerActionDesc: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  primaryCtaBtnText: {
    color: colors.textInverse,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  conditionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  miniPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  miniPillText: {
    fontWeight: '700',
  },
  cardsColumn: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  recordCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  recordTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  medBadgeCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  activeDrugBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
    flexShrink: 0,
  },
  activeDrugBadgeText: {
    color: colors.successText,
    fontWeight: '700',
  },
  timesChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  timeChipText: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recordDateMeta: {
    marginTop: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  cardSecondaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardActionPrimaryWide: {
    flex: 1.85,
  },
  cardSecondaryBtnText: {
    color: colors.primaryDark,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  cardDangerBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  cardDangerBtnText: {
    color: colors.dangerText,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  conditionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  severityPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    maxWidth: '100%',
  },
  severityPillText: {
    fontWeight: '700',
    flexShrink: 1,
  },
  conditionDateText: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontWeight: '600',
  },
  conditionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  clinicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  clinicMetaText: {
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  nextCheckupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  nextCheckupText: {
    color: colors.primaryDark,
    fontWeight: '700',
    flexShrink: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(38, 51, 45, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  modalTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalJumpTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  modalJumpTodayText: {
    fontWeight: '800',
    color: colors.primaryDark,
    flexShrink: 1,
  },
  modalDateList: {
    gap: 8,
  },
  modalDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalDateItemActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  modalDateLeft: {
    flex: 1,
    minWidth: 0,
  },
  modalDatePrimary: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalDatePrimaryActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  modalDateSecondary: {
    marginTop: 1,
    color: colors.textSecondary,
  },
  modalDateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  modalDateCount: {
    fontWeight: '700',
    color: colors.primary,
  },
  modalDateCountEmpty: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  routineSummaryCard: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  routineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  routineTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  routineCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  routineSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexShrink: 0,
  },
  routineSetupBtnText: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  routineItemBox: {
    gap: 6,
  },
  routineItemDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  routineItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  routineItemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routineItemLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  routineWaterValue: {
    fontWeight: '800',
    color: colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  routineProgressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surfaceWarm,
    overflow: 'hidden',
  },
  routineProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  routineSubMeta: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  routineSleepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  routineSleepBadgeText: {
    fontWeight: '700',
  },
});
