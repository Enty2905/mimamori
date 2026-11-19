import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../core/theme/colors';
import { apiClient } from '../../core/api/client';

interface CareAlert {
  id: number;
  alertType: 'MISSED_MEDICATION' | 'MISSED_CHECKIN' | 'CHECKIN_CONCERN' | 'EMERGENCY_BUTTON';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export const CaregiverAlertsScreen: React.FC = () => {
  const [alerts, setAlerts] = useState<CareAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNRESOLVED'>('UNRESOLVED');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await apiClient<CareAlert[]>('/api/alerts');
      if (res.success && res.data) {
        setAlerts(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleResolve = async (alertId: number) => {
    try {
      setResolvingId(alertId);
      const res = await apiClient(`/api/alerts/${alertId}/resolve`, { method: 'PUT' });
      if (res.success) {
        Alert.alert('Thành công', 'Đã đánh dấu xử lý cảnh báo này.');
        fetchAlerts();
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật cảnh báo');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => (filter === 'UNRESOLVED' ? !a.resolved : true));

  const getSeverityBadge = (severity: CareAlert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return { label: 'KHẨN CẤP', bg: '#FEE2E2', text: '#DC2626' };
      case 'HIGH':
        return { label: 'MỨC ĐỘ CAO', bg: '#FEF3C7', text: '#D97706' };
      case 'MEDIUM':
        return { label: 'TRUNG BÌNH', bg: '#E0E7FF', text: '#4F46E5' };
      default:
        return { label: 'THÔNG TIN', bg: '#F1F5F9', text: '#64748B' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Cảnh báo an toàn người thân</Text>
        <Text style={styles.subtitle}>Care Agent tự động phát hiện và gửi thông báo</Text>

        {/* Filter Toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'UNRESOLVED' && styles.filterBtnActive]}
            onPress={() => setFilter('UNRESOLVED')}
          >
            <Text style={[styles.filterText, filter === 'UNRESOLVED' && styles.filterTextActive]}>
              Chưa xử lý ({alerts.filter((a) => !a.resolved).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'ALL' && styles.filterBtnActive]}
            onPress={() => setFilter('ALL')}
          >
            <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>
              Tất cả ({alerts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải cảnh báo...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="shield" size={28} color={colors.successText} />
              </View>
              <Text style={styles.emptyTitle}>Mọi thứ đều an toàn!</Text>
              <Text style={styles.emptySub}>
                Không có cảnh báo nào chưa được xử lý vào lúc này.
              </Text>
            </View>
          ) : (
            filteredAlerts.map((item) => {
              const sev = getSeverityBadge(item.severity);
              return (
                <View key={item.id} style={[styles.alertCard, item.resolved && styles.alertCardResolved]}>
                  <View style={styles.alertTopRow}>
                    <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.sevBadgeText, { color: sev.text }]}>{sev.label}</Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertDesc}>{item.description}</Text>

                  {!item.resolved ? (
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => handleResolve(item.id)}
                      disabled={resolvingId === item.id}
                      activeOpacity={0.8}
                    >
                      {resolvingId === item.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="check" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.resolveBtnText}>Xác nhận đã kiểm tra & xử lý</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.resolvedBadge}>
                      <Feather name="check" size={12} color={colors.successText} style={{ marginRight: 4 }} />
                      <Text style={styles.resolvedText}>Đã xử lý xong</Text>
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

const styles = StyleSheet.create({
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
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
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
    paddingBottom: 100,
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
    backgroundColor: '#F8FAFC',
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 1,
  },
  sevBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 0,
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
    lineHeight: 18,
  },
  resolveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  resolvedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.successText,
    flexShrink: 1,
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

