import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { apiClient } from '../../core/api/client';

interface FamilyMember {
  relationshipId: number;
  member: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    role: string;
  };
  relationshipType: string;
  status: string;
  canViewConversations: boolean;
}

export const CaregiverFamilyScreen: React.FC = () => {
  const { user, logout, demoLogin } = useAuthStore();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [elderlyUsername, setElderlyUsername] = useState('');
  const [relationship, setRelationship] = useState('Bố');
  const [linking, setLinking] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await apiClient<FamilyMember[]>('/api/family/members');
      if (res.success && res.data) {
        setMembers(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleLink = async () => {
    if (!elderlyUsername.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đăng nhập của người cao tuổi');
      return;
    }

    try {
      setLinking(true);
      const res = await apiClient('/api/family/link', {
        method: 'POST',
        body: JSON.stringify({
          elderlyUsername: elderlyUsername.trim(),
          relationship,
        }),
      });

      if (res.success) {
        Alert.alert('Thành công', 'Đã liên kết thành công với người cao tuổi!');
        setModalVisible(false);
        setElderlyUsername('');
        fetchMembers();
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể liên kết tài khoản');
    } finally {
      setLinking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Caregiver Profile Banner */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Feather name="users" size={26} color={colors.primary} />
        </View>
        <Text style={styles.userName}>{user?.fullName || 'Người chăm sóc'}</Text>
        <Text style={styles.userUsername}>@{user?.username}</Text>
        <View style={styles.roleBadge}>
          <Feather name="shield" size={12} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.roleBadgeText}>VAI TRÒ: NGƯỜI CHĂM SÓC / GIA ĐÌNH</Text>
        </View>
      </View>

      {/* Linked Elderly Members */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="user-check" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Người thân đang giám sát</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            <Feather name="plus" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Thêm liên kết</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : members.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="users" size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
            <Text style={styles.emptyText}>Chưa liên kết với người cao tuổi nào.</Text>
          </View>
        ) : (
          members.map((item) => (
            <View key={item.relationshipId} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Feather name="user" size={20} color={colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.member.fullName}</Text>
                <Text style={styles.memberSub}>
                  @{item.member.username} • Quan hệ: {item.relationshipType}
                </Text>
                <View style={styles.connectedTag}>
                  <Feather name="check" size={12} color={colors.successText} style={{ marginRight: 4 }} />
                  <Text style={styles.connectedText}>Đã kết nối an toàn</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Demo Role Switcher */}
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Feather name="repeat" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Chuyển đổi vai trò trải nghiệm</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Nhấn nút bên dưới để chuyển sang giao diện Người cao tuổi (Elderly App):
        </Text>
        <TouchableOpacity
          style={styles.switchRoleBtn}
          onPress={() => demoLogin('ELDERLY')}
          activeOpacity={0.8}
        >
          <Feather name="user" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.switchRoleText}>Chuyển sang vai trò: Người cao tuổi</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
          ]);
        }}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={16} color={colors.dangerText} style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Đăng xuất khỏi tài khoản</Text>
      </TouchableOpacity>

      {/* Modal Link Elderly */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Liên kết người cao tuổi mới</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Tên đăng nhập của cụ *</Text>
            <View style={styles.modalInputWrap}>
              <Feather name="at-sign" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                placeholder="Ví dụ: ong_ba hoặc Huyn"
                value={elderlyUsername}
                onChangeText={setElderlyUsername}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Text style={styles.modalLabel}>Mối quan hệ *</Text>
            <View style={styles.modalInputWrap}>
              <Feather name="heart" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                placeholder="Ví dụ: Bố, Mẹ, Ông, Bà..."
                value={relationship}
                onChangeText={setRelationship}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={linking}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleLink}
                disabled={linking}
              >
                {linking ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Tạo kết nối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  profileCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 22,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userUsername: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionDesc: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginVertical: 8,
    lineHeight: 18,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  memberSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  connectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  switchRoleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginBottom: 30,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.dangerText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    ...shadows.elevated,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});