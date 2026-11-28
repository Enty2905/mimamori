import {useOriginalLabels} from '../../core/localization/original';
import {useColors} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React, { useState } from 'react';
import {
  View,
    StyleSheet,
  ScrollView,
    ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors } from '../../core/theme/colors';
import {careApi} from '../../core/api/careApi';
import {CareAlert} from '../../core/api/contracts';
import {useQuery} from '@tanstack/react-query';
import {useAuthStore} from '../../core/auth/useAuthStore';
import {Notice,Button} from '../../components/CareUI';

export const CaregiverAlertsScreen: React.FC = () => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const owner=useAuthStore(state=>state.userId);
  const query=useQuery({queryKey:['alerts',owner],enabled:!!owner,queryFn:careApi.alerts});
  const alerts=query.data ?? [];
  const loading=query.isPending;
  const fetchAlerts=()=>query.refetch();
  const [filter,setFilter]=useState<'ALL'|'UNRESOLVED'>('UNRESOLVED');
  const [resolvingId,setResolvingId]=useState<number|null>(null);
  const handleResolve = async (alertId: number) => {
    try {
      setResolvingId(alertId);
      await careApi.resolve(alertId);
       {
        Alert.alert(tr("Thành công"), tr("Đã đánh dấu xử lý cảnh báo này."));
        fetchAlerts();
      }
    } catch (err: unknown) {
      Alert.alert(tr("Lỗi"), (err instanceof Error ? err.message : '') || 'Không thể cập nhật cảnh báo');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => (filter === 'UNRESOLVED' ? !a.isResolved : true));

  const getSeverityBadge = (severity: CareAlert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return { label: 'KHẨN CẤP', bg: colors.background === baseColors.background ? '#FEE2E2' : colors.surfaceWarm, text: colors.background === baseColors.background ? '#DC2626' : colors.textPrimary };
      case 'HIGH':
        return { label: 'MỨC ĐỘ CAO', bg: colors.background === baseColors.background ? '#FEF3C7' : colors.surfaceWarm, text: colors.background === baseColors.background ? '#D97706' : colors.textPrimary };
      case 'MEDIUM':
        return { label: 'TRUNG BÌNH', bg: colors.background === baseColors.background ? '#E0E7FF' : colors.surfaceWarm, text: colors.background === baseColors.background ? '#4F46E5' : colors.textPrimary };
      default:
        return { label: 'THÔNG TIN', bg: colors.background === baseColors.background ? '#F1F5F9' : colors.surfaceWarm, text: colors.background === baseColors.background ? '#64748B' : colors.textPrimary };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{tr("Cảnh báo an toàn người thân")}</Text>
        <Text style={styles.subtitle}>{tr("Care Agent tự động phát hiện và gửi thông báo")}</Text>

        {/* Filter Toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'UNRESOLVED' && styles.filterBtnActive]}
            onPress={() => setFilter('UNRESOLVED')}
          >
            <Text style={[styles.filterText, filter === 'UNRESOLVED' && styles.filterTextActive]}>{tr("Chưa xử lý (")}{alerts.filter((a) => !a.isResolved).length}{tr(")")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'ALL' && styles.filterBtnActive]}
            onPress={() => setFilter('ALL')}
          >
            <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>{tr("Tất cả (")}{alerts.length}{tr(")")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {query.isError && <><Notice tone="danger" text={tr("Không thể tải cảnh báo.")} /><Button title={tr("Thử lại")} onPress={()=>{void fetchAlerts();}} /></>}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{tr("Đang tải cảnh báo...")}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {query.isError ? null : filteredAlerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="shield" size={28} color={colors.successText} />
              </View>
              <Text style={styles.emptyTitle}>{tr("Mọi thứ đều an toàn!")}</Text>
              <Text style={styles.emptySub}>{tr("Không có cảnh báo nào chưa được xử lý vào lúc này.")}</Text>
            </View>
          ) : (
            filteredAlerts.map((item) => {
              const sev = getSeverityBadge(item.severity);
              return (
                <View key={item.id} style={[styles.alertCard, item.isResolved && styles.alertCardResolved]}>
                  <View style={styles.alertTopRow}>
                    <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.sevBadgeText, { color: sev.text }]}>{sev.label}</Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <Text style={styles.alertTitle}>{item.title || item.alertType}</Text>
                  <Text style={styles.alertDesc}>{item.description}</Text>

                  {!item.isResolved ? (
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => handleResolve(item.id)}
                      disabled={resolvingId === item.id}
                      activeOpacity={0.8}
                    >
                      {resolvingId === item.id ? (
                        <ActivityIndicator color={colors.textInverse} size="small" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="check" size={14} color={colors.textInverse} style={{ marginRight: 6 }} />
                          <Text style={styles.resolveBtnText}>{tr("Xác nhận đã kiểm tra & xử lý")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.resolvedBadge}>
                      <Feather name="check" size={12} color={colors.successText} style={{ marginRight: 4 }} />
                      <Text style={styles.resolvedText}>{tr("Đã xử lý xong")}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  alertCardResolved: {
    opacity: 0.65,
    backgroundColor: colors.background === baseColors.background ? '#F8FAFC' : colors.surfaceWarm,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sevBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alertDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,

  },
  resolveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  resolveBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  resolvedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 40,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
});
