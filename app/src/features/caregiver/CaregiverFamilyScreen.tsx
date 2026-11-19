import React, { useCallback, useEffect, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { AVATAR_PRESETS, getAvatarSource } from '../../core/theme/avatar';
import {
  useAccessibilityStore,
  FONT_SIZE_OPTIONS,
  FontSizeLevel,
} from '../../core/accessibility/useAccessibilityStore';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { apiClient } from '../../core/api/client';
import { FamilyMemberDto, formatTimeHHMM } from '../../core/utils/caregiverHelpers';
import { CaregiverHeader } from '../../components/caregiver/CaregiverHeader';

type SubView = 'main' | 'personalInfo' | 'displaySettings' | 'securityPrivacy';
type SecurityTab = 'change' | 'forgot';

const RELATIONSHIP_PRESETS = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Người thân'] as const;

const getShortFontLabel = (id: FontSizeLevel): string => {
  switch (id) {
    case 'small':
      return 'Nhỏ';
    case 'standard':
      return 'TB';
    case 'large':
      return 'Lớn';
    case 'xlarge':
      return 'Rất lớn';
    default:
      return 'TB';
  }
};

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
  }
  return fallback;
};

export const CaregiverFamilyScreen: React.FC = () => {
  const { user, logout, demoLogin, updateUser } = useAuthStore();
  const { fontSizeLevel, setFontSizeLevel, fs } = useAccessibilityStore();

  const [subView, setSubView] = useState<SubView>('main');

  // Family members state
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Link modal & role switch state
  const [modalVisible, setModalVisible] = useState(false);
  const [elderlyUsername, setElderlyUsername] = useState('');
  const [relationship, setRelationship] = useState('Bố');
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  // Display settings toggles
  const [highContrast, setHighContrast] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Personal info form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(user?.avatarUrl || 'leaf');
  const [savingProfile, setSavingProfile] = useState(false);

  // Security & privacy form state
  const [securityTab, setSecurityTab] = useState<SecurityTab>('change');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [forgotIdentifier, setForgotIdentifier] = useState(user?.username || user?.email || '');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  const currentFontOption =
    FONT_SIZE_OPTIONS.find((o) => o.id === fontSizeLevel) || FONT_SIZE_OPTIONS[1];

  const fetchMembers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      const res = await apiClient<FamilyMemberDto[]>('/api/family/members');
      if (res.success && Array.isArray(res.data)) {
        setMembers(res.data);
        setLastUpdated(`${formatTimeHHMM(new Date().toISOString())} hôm nay`);
      } else {
        setLoadError(res.message || 'Không thể tải danh sách gia đình.');
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Không thể tải danh sách thành viên gia đình.');
      setLoadError(message);
      if (isRefresh) {
        Alert.alert('Lỗi làm mới', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers(false);
  }, [fetchMembers]);

  const openPersonalInfo = () => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setSelectedAvatarId(user?.avatarUrl || 'leaf');
    setSubView('personalInfo');
  };

  const openSecurityPrivacy = () => {
    setSecurityTab('change');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setForgotIdentifier(user?.username || user?.email || '');
    setForgotNewPassword('');
    setShowForgotPw(false);
    setSubView('securityPrivacy');
  };

  const openLinkModal = () => {
    setElderlyUsername('');
    setRelationship('Bố');
    setModalVisible(true);
  };

  const closeLinkModal = () => {
    if (linking) return;
    setModalVisible(false);
  };

  const handleLink = async () => {
    const trimmedUsername = elderlyUsername.trim();
    const trimmedRelationship = relationship.trim() || 'Gia đình';

    if (!trimmedUsername) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đăng nhập của người cao tuổi.');
      return;
    }

    try {
      setLinking(true);
      const res = await apiClient('/api/family/link', {
        method: 'POST',
        body: JSON.stringify({
          elderlyUsername: trimmedUsername,
          relationshipType: trimmedRelationship,
        }),
      });

      if (res.success) {
        Alert.alert('Thành công', 'Đã liên kết thành công với người cao tuổi!');
        setModalVisible(false);
        setElderlyUsername('');
        setRelationship('Bố');
        fetchMembers(true);
      } else {
        Alert.alert('Không thể liên kết', res.message || 'Không thể tạo liên kết tài khoản.');
      }
    } catch (err: unknown) {
      Alert.alert(
        'Không thể liên kết',
        getErrorMessage(err, 'Vui lòng kiểm tra lại tên đăng nhập của người cao tuổi và thử lại.')
      );
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (item: FamilyMemberDto) => {
    try {
      setUnlinkingId(item.relationshipId);
      const res = await apiClient(`/api/family/link/${item.relationshipId}`, {
        method: 'DELETE',
      });

      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.relationshipId !== item.relationshipId));
        Alert.alert('Đã ngắt kết nối', `Đã gỡ liên kết với ${item.member.fullName}.`);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể ngắt kết nối tài khoản.');
      }
    } catch (err: unknown) {
      Alert.alert('Lỗi', getErrorMessage(err, 'Không thể ngắt kết nối tài khoản.'));
    } finally {
      setUnlinkingId(null);
    }
  };

  const confirmUnlink = (item: FamilyMemberDto) => {
    Alert.alert(
      'Ngắt kết nối',
      `Bạn có chắc chắn muốn ngắt kết nối với ${item.member.fullName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Ngắt kết nối',
          style: 'destructive',
          onPress: () => handleUnlink(item),
        },
      ]
    );
  };

  const handleSwitchToElderly = async () => {
    try {
      setSwitchingRole(true);
      await demoLogin('ELDERLY');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim() || null;

    if (!trimmedName) {
      Alert.alert('Lưu ý', 'Vui lòng nhập họ và tên của bạn.');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await apiClient('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: trimmedName,
          phone: trimmedPhone,
          avatarUrl: selectedAvatarId,
        }),
      });

      if (res.success) {
        updateUser({
          fullName: trimmedName,
          phone: trimmedPhone,
          avatarUrl: selectedAvatarId,
        });
        Alert.alert('Thành công', 'Thông tin cá nhân đã được cập nhật!');
        setSubView('main');
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể lưu thông tin lúc này.');
      }
    } catch (err: unknown) {
      Alert.alert('Lỗi', getErrorMessage(err, 'Không thể lưu thông tin lúc này.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Lưu ý', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Lưu ý', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lưu ý', 'Xác nhận mật khẩu mới không khớp.');
      return;
    }

    try {
      setSavingPassword(true);
      const res = await apiClient('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.success) {
        Alert.alert('Thành công', 'Đổi mật khẩu tài khoản thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSubView('main');
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể đổi mật khẩu lúc này.');
      }
    } catch (err: unknown) {
      Alert.alert('Lỗi', getErrorMessage(err, 'Không thể đổi mật khẩu lúc này.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedIdentifier = forgotIdentifier.trim();
    if (!trimmedIdentifier) {
      Alert.alert('Lưu ý', 'Vui lòng nhập tên đăng nhập hoặc email.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      Alert.alert('Lưu ý', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setRecoveringPassword(true);
      const res = await apiClient('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          usernameOrEmail: trimmedIdentifier,
          newPassword: forgotNewPassword,
        }),
      });

      if (res.success) {
        Alert.alert(
          'Thành công',
          'Khôi phục mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới này.'
        );
        setForgotNewPassword('');
        setSubView('main');
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể khôi phục mật khẩu lúc này.');
      }
    } catch (err: unknown) {
      Alert.alert('Lỗi', getErrorMessage(err, 'Không thể khôi phục mật khẩu lúc này.'));
    } finally {
      setRecoveringPassword(false);
    }
  };

  const renderBackHeader = (title: string) => (
    <View style={styles.subHeaderRow}>
      <TouchableOpacity
        style={styles.backBtnCircle}
        onPress={() => setSubView('main')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
      >
        <Feather name="chevron-left" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.subHeaderTitle, { fontSize: fs(18.5) }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.subHeaderSpacer} />
    </View>
  );

  // ==========================================
  // SUBVIEW: THÔNG TIN CÁ NHÂN
  // ==========================================
  if (subView === 'personalInfo') {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.subContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderBackHeader('Thông tin cá nhân')}

          {/* Avatar 2x2 Grid */}
          <View style={styles.sectionCard}>
            <Text style={[styles.subSectionTitle, { fontSize: fs(16) }]}>Ảnh đại diện</Text>
            <Text style={[styles.subSectionHint, { fontSize: fs(12.5) }]}>
              Chọn hình đại diện thân thiện để người thân dễ nhận diện:
            </Text>

            <View style={styles.avatarPickerRow}>
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedAvatarId === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.avatarPickItem, isSelected && styles.avatarPickItemActive]}
                    onPress={() => setSelectedAvatarId(preset.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={preset.label}
                  >
                    <Image source={preset.source} style={styles.avatarPickImg} resizeMode="cover" />
                    {isSelected && (
                      <View style={styles.avatarCheckBadge}>
                        <Feather name="check" size={12} color={colors.textInverse} />
                      </View>
                    )}
                    <Text
                      style={[
                        styles.avatarPickLabel,
                        { fontSize: fs(12) },
                        isSelected && styles.avatarPickLabelActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Personal Form */}
          <View style={styles.sectionCard}>
            <Text style={[styles.subSectionTitle, { fontSize: fs(16) }]}>
              Hồ sơ người giám sát
            </Text>

            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>Họ và tên *</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
              <TextInput
                style={[styles.textInput, { fontSize: fs(14.5) }]}
                placeholder="Ví dụ: Nguyễn Minh Anh"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={colors.textMuted}
                editable={!savingProfile}
              />
            </View>

            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>Tên tài khoản</Text>
            <View style={[styles.inputWrap, styles.inputWrapDisabled]}>
              <Feather
                name="at-sign"
                size={16}
                color={colors.textSecondary}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                style={[styles.textInput, styles.textInputReadonly, { fontSize: fs(14.5) }]}
                value={(user?.username || 'caregiver').replace(/^@+/, '')}
                editable={false}
              />
              <View style={styles.readonlyBadge}>
                <Text style={[styles.readonlyBadgeText, { fontSize: fs(11) }]}>Mặc định</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>Số điện thoại</Text>
            <View style={styles.inputWrap}>
              <Feather
                name="phone"
                size={16}
                color={colors.primary}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                style={[styles.textInput, { fontSize: fs(14.5) }]}
                placeholder="Ví dụ: 0912 345 678"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
                editable={!savingProfile}
              />
            </View>

            <View style={styles.roleStaticRow}>
              <Text style={[styles.roleStaticLabel, { fontSize: fs(13) }]}>
                Vai trò trong hệ thống:
              </Text>
              <View style={styles.rolePill}>
                <Feather name="shield" size={12} color={colors.primary} />
                <Text style={[styles.rolePillText, { fontSize: fs(11.5) }]}>
                  Người giám sát (CAREGIVER)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, savingProfile && styles.saveBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Lưu thông tin cá nhân"
            >
              {savingProfile ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={[styles.primaryActionBtnText, { fontSize: fs(14.5) }]}>
                  Lưu thông tin cá nhân
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // SUBVIEW: CÀI ĐẶT HIỂN THỊ
  // ==========================================
  if (subView === 'displaySettings') {
    return (
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.subContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderBackHeader('Cài đặt hiển thị')}

          <View style={styles.displayBlock}>
            <Text style={[styles.displayHeading, { fontSize: fs(17.5) }]}>
              Cỡ chữ hiển thị
            </Text>
            <Text style={[styles.displaySub, { fontSize: fs(13) }]}>
              Điều chỉnh kích thước chữ phù hợp để theo dõi sức khỏe người thân thoải mái hơn.
            </Text>

            {/* Live Preview Card */}
            <View style={styles.livePreviewCard}>
              <Text style={[styles.previewGreeting, { fontSize: fs(16.5) }]}>
                Xin chào {user?.fullName || 'bạn'}!{'\n'}Đây là cỡ chữ xem trước trên toàn bộ ứng dụng.
              </Text>
              <Text style={[styles.previewCurrentLabel, { fontSize: fs(12.5) }]}>
                Cỡ chữ hiện tại: {currentFontOption.label} ({currentFontOption.sublabel})
              </Text>
            </View>

            {/* 4-Step Interactive Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrackLine} />
              <View style={styles.sliderStepsRow}>
                {FONT_SIZE_OPTIONS.map((opt) => {
                  const isSelected = opt.id === fontSizeLevel;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.sliderStepItem}
                      onPress={() => setFontSizeLevel(opt.id)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Cỡ chữ ${opt.label}`}
                    >
                      <View
                        style={[
                          styles.sliderDotBase,
                          isSelected ? styles.sliderDotActive : styles.sliderDotInactive,
                        ]}
                      >
                        {isSelected && <View style={styles.sliderDotInner} />}
                      </View>
                      <Text
                        style={[
                          styles.sliderStepText,
                          { fontSize: fs(12.5) },
                          isSelected && styles.sliderStepTextActive,
                        ]}
                      >
                        {getShortFontLabel(opt.id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* High contrast & night mode toggles */}
          <View style={styles.menuCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={[styles.toggleTitle, { fontSize: fs(14.5) }]}>
                  Tăng độ tương phản
                </Text>
                <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>
                  Làm rõ đường viền và chữ trên thẻ thông tin
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.textInverse}
              />
            </View>

            <View style={[styles.toggleRow, styles.menuRowLast]}>
              <View style={styles.toggleTextWrap}>
                <Text style={[styles.toggleTitle, { fontSize: fs(14.5) }]}>
                  Chế độ ban đêm
                </Text>
                <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>
                  Dịu mắt khi theo dõi người thân vào buổi tối
                </Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.textInverse}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={() => setSubView('main')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Áp dụng và quay lại"
          >
            <Text style={[styles.primaryActionBtnText, { fontSize: fs(14.5) }]}>
              Áp dụng & Quay lại
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // SUBVIEW: BẢO MẬT & QUYỀN RIÊNG TƯ
  // ==========================================
  if (subView === 'securityPrivacy') {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.subContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderBackHeader('Bảo mật & Quyền riêng tư')}

          {/* Segmented Tab */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, securityTab === 'change' && styles.segmentBtnActive]}
              onPress={() => setSecurityTab('change')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: securityTab === 'change' }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { fontSize: fs(13.5) },
                  securityTab === 'change' && styles.segmentTextActive,
                ]}
              >
                Đổi mật khẩu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, securityTab === 'forgot' && styles.segmentBtnActive]}
              onPress={() => setSecurityTab('forgot')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: securityTab === 'forgot' }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { fontSize: fs(13.5) },
                  securityTab === 'forgot' && styles.segmentTextActive,
                ]}
              >
                Quên mật khẩu
              </Text>
            </TouchableOpacity>
          </View>

          {securityTab === 'change' ? (
            <View style={styles.sectionCard}>
              <Text style={[styles.subSectionTitle, { fontSize: fs(16) }]}>
                Cập nhật mật khẩu mới
              </Text>
              <Text style={[styles.subSectionHint, { fontSize: fs(12.5) }]}>
                Đặt mật khẩu an toàn có ít nhất 6 ký tự để bảo vệ tài khoản người giám sát.
              </Text>

              <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>Mật khẩu hiện tại *</Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="lock"
                  size={16}
                  color={colors.primary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Nhập mật khẩu đang dùng"
                  secureTextEntry={!showCurrentPw}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholderTextColor={colors.textMuted}
                  editable={!savingPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPw((prev) => !prev)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Ẩn hoặc hiện mật khẩu hiện tại"
                >
                  <Feather
                    name={showCurrentPw ? 'eye' : 'eye-off'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>Mật khẩu mới *</Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="shield"
                  size={16}
                  color={colors.primary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ít nhất 6 ký tự"
                  secureTextEntry={!showNewPw}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholderTextColor={colors.textMuted}
                  editable={!savingPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPw((prev) => !prev)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Ẩn hoặc hiện mật khẩu mới"
                >
                  <Feather
                    name={showNewPw ? 'eye' : 'eye-off'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>
                Xác nhận mật khẩu mới *
              </Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="check"
                  size={16}
                  color={colors.primary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Nhập lại mật khẩu mới"
                  secureTextEntry={!showConfirmPw}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor={colors.textMuted}
                  editable={!savingPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPw((prev) => !prev)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Ẩn hoặc hiện xác nhận mật khẩu"
                >
                  <Feather
                    name={showConfirmPw ? 'eye' : 'eye-off'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, savingPassword && styles.saveBtnDisabled]}
                onPress={handleChangePassword}
                disabled={savingPassword}
                activeOpacity={0.8}
              >
                {savingPassword ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={[styles.primaryActionBtnText, { fontSize: fs(14.5) }]}>
                    Lưu mật khẩu mới
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={[styles.subSectionTitle, { fontSize: fs(16) }]}>
                Khôi phục tài khoản
              </Text>
              <Text style={[styles.subSectionHint, { fontSize: fs(12.5) }]}>
                Nếu bạn hoặc người thân quên mật khẩu, hãy nhập tên đăng nhập hoặc email đã đăng ký để đặt lại.
              </Text>

              <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>
                Tên đăng nhập hoặc Email *
              </Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="user"
                  size={16}
                  color={colors.primary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ví dụ: con_gai hoặc email"
                  value={forgotIdentifier}
                  onChangeText={setForgotIdentifier}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!recoveringPassword}
                />
              </View>

              <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>
                Mật khẩu mới mong muốn *
              </Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="key"
                  size={16}
                  color={colors.primary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.textInput, { fontSize: fs(14.5) }]}
                  placeholder="Ít nhất 6 ký tự"
                  secureTextEntry={!showForgotPw}
                  value={forgotNewPassword}
                  onChangeText={setForgotNewPassword}
                  placeholderTextColor={colors.textMuted}
                  editable={!recoveringPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowForgotPw((prev) => !prev)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Ẩn hoặc hiện mật khẩu khôi phục"
                >
                  <Feather
                    name={showForgotPw ? 'eye' : 'eye-off'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, recoveringPassword && styles.saveBtnDisabled]}
                onPress={handleForgotPassword}
                disabled={recoveringPassword}
                activeOpacity={0.8}
              >
                {recoveringPassword ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={[styles.primaryActionBtnText, { fontSize: fs(14.5) }]}>
                    Khôi phục mật khẩu ngay
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Security Commitment Box */}
          <View style={styles.securityCommitmentBox}>
            <View style={styles.commitmentHeader}>
              <Feather
                name="shield"
                size={18}
                color={colors.successText}
                style={styles.commitmentIcon}
              />
              <Text style={[styles.commitmentTitle, { fontSize: fs(14) }]}>
                Bảo mật cấp y tế Mimamori AI
              </Text>
            </View>
            <Text style={[styles.commitmentDesc, { fontSize: fs(12.5) }]}>
              • Dữ liệu sức khỏe, lịch uống thuốc và nhật ký trò chuyện được mã hóa an toàn.{'\n'}
              • Chỉ thành viên gia đình được liên kết hợp lệ mới có quyền theo dõi trạng thái người thân.{'\n'}
              • Tuyệt đối không chia sẻ dữ liệu cho bên thứ ba.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // MAIN VIEW: GIA ĐÌNH & CÀI ĐẶT NGƯỜI GIÁM SÁT
  // ==========================================
  return (
    <View style={styles.screen}>
      <CaregiverHeader
        title="Gia đình & Liên kết"
        subtitle="Quản lý thành viên người thân đang kết nối."
        lastUpdated={lastUpdated}
        onRefresh={() => fetchMembers(true)}
        refreshing={refreshing}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMembers(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Caregiver Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={openPersonalInfo}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa thông tin cá nhân"
          >
            <Feather name="edit-2" size={15} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openPersonalInfo}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Thay đổi ảnh đại diện"
          >
            <Image source={getAvatarSource(user?.avatarUrl)} style={styles.profileAvatar} />
          </TouchableOpacity>

          <Text style={[styles.userName, { fontSize: fs(18) }]}>
            {user?.fullName || 'Người chăm sóc'}
          </Text>

          <View style={styles.rolePill}>
            <Feather name="shield" size={13} color={colors.primary} />
            <Text style={[styles.rolePillText, { fontSize: fs(12) }]}>
              Người chăm sóc / Gia đình
            </Text>
          </View>

          {Boolean(user?.phone) && (
            <View style={styles.phoneRow}>
              <Feather name="phone" size={13} color={colors.textSecondary} />
              <Text style={[styles.phoneText, { fontSize: fs(13) }]}>{user?.phone}</Text>
            </View>
          )}
        </View>

        {/* Account & Display Settings Menu Card */}
        <View style={styles.menuCard}>
          <View style={styles.menuCardHeader}>
            <Feather name="settings" size={16} color={colors.primary} />
            <Text style={[styles.menuCardTitle, { fontSize: fs(15) }]}>
              Cài đặt tài khoản & hiển thị
            </Text>
          </View>

          <TouchableOpacity
            style={styles.menuRowItem}
            onPress={openPersonalInfo}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.menuLeftCol}>
              <View style={styles.menuIconBox}>
                <Feather name="user" size={17} color={colors.primary} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={[styles.menuTitleText, { fontSize: fs(14.5) }]}>
                  Thông tin cá nhân
                </Text>
                <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>
                  Ảnh đại diện, họ tên, số điện thoại
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRowItem}
            onPress={() => setSubView('displaySettings')}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.menuLeftCol}>
              <View style={styles.menuIconBox}>
                <Feather name="sliders" size={17} color={colors.primary} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={[styles.menuTitleText, { fontSize: fs(14.5) }]}>
                  Cài đặt hiển thị
                </Text>
                <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>
                  Cỡ chữ hiện tại: {currentFontOption.label}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRowItem, styles.menuRowLast]}
            onPress={openSecurityPrivacy}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.menuLeftCol}>
              <View style={styles.menuIconBox}>
                <Feather name="lock" size={17} color={colors.primary} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={[styles.menuTitleText, { fontSize: fs(14.5) }]}>
                  Bảo mật & Quyền riêng tư
                </Text>
                <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>
                  Đổi mật khẩu, khôi phục tài khoản
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Linked Elderly List */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Feather name="users" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { fontSize: fs(15.5) }]}>
                Người thân đang giám sát ({members.length})
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addBtn}
              onPress={openLinkModal}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Thêm liên kết người thân"
            >
              <Feather name="plus" size={14} color={colors.textInverse} />
              <Text style={[styles.addBtnText, { fontSize: fs(12.5) }]}>Thêm liên kết</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { fontSize: fs(13) }]}>
                Đang tải danh sách người thân...
              </Text>
            </View>
          ) : loadError && members.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="alert-circle" size={24} color={colors.warningText} />
              <Text style={[styles.emptyTitle, { fontSize: fs(14) }]}>
                Chưa tải được danh sách liên kết
              </Text>
              <Text style={[styles.emptyText, { fontSize: fs(12.5) }]}>{loadError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchMembers(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.retryBtnText, { fontSize: fs(13) }]}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Feather name="user-plus" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { fontSize: fs(14.5) }]}>
                Chưa liên kết với người cao tuổi nào
              </Text>
              <Text style={[styles.emptyText, { fontSize: fs(12.5) }]}>
                Nhấn {'"+ Thêm liên kết"'} để kết nối với tài khoản người thân và theo dõi sức khỏe mỗi ngày.
              </Text>
            </View>
          ) : (
            <View style={styles.memberList}>
              {members.map((item) => {
                const isUnlinking = unlinkingId === item.relationshipId;
                const canViewConv = Boolean(item.canViewConversations);

                return (
                  <View key={item.relationshipId} style={styles.memberCard}>
                    <View style={styles.memberTopRow}>
                      <Image
                        source={getAvatarSource(item.member.avatarUrl)}
                        style={styles.memberAvatar}
                      />

                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { fontSize: fs(15.5) }]}>
                          {item.member.fullName}
                        </Text>
                        <Text style={[styles.memberMeta, { fontSize: fs(12.5) }]}>
                          Quan hệ: {item.relationshipType || 'Gia đình'}
                        </Text>
                        {Boolean(item.member.phone) && (
                          <Text style={[styles.memberPhone, { fontSize: fs(12) }]}>
                            SĐT: {item.member.phone}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.badgesRow}>
                      <View style={styles.connectedTag}>
                        <Feather name="check-circle" size={12} color={colors.successText} />
                        <Text style={[styles.connectedText, { fontSize: fs(11.5) }]}>
                          Đã kết nối an toàn
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.permissionTag,
                          canViewConv ? styles.permissionTagAllowed : styles.permissionTagLimited,
                        ]}
                      >
                        <Feather
                          name={canViewConv ? 'message-circle' : 'shield'}
                          size={12}
                          color={canViewConv ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.permissionText,
                            { fontSize: fs(11.5) },
                            canViewConv
                              ? styles.permissionTextAllowed
                              : styles.permissionTextLimited,
                          ]}
                        >
                          {canViewConv
                            ? 'Được phép xem nhật ký trò chuyện'
                            : 'Chỉ xem tổng quan sức khỏe'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.memberActionsRow}>
                      <TouchableOpacity
                        style={styles.unlinkBtn}
                        onPress={() => confirmUnlink(item)}
                        disabled={isUnlinking}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Ngắt kết nối với ${item.member.fullName}`}
                      >
                        {isUnlinking ? (
                          <ActivityIndicator size="small" color={colors.dangerText} />
                        ) : (
                          <>
                            <Feather name="link-2" size={13} color={colors.dangerText} />
                            <Text style={[styles.unlinkBtnText, { fontSize: fs(12.5) }]}>
                              Ngắt kết nối
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Demo Role Switcher */}
        <View style={styles.sectionCard}>
          <View style={styles.demoHeaderRow}>
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { fontSize: fs(15) }]}>
              Chuyển đổi vai trò trải nghiệm
            </Text>
          </View>
          <Text style={[styles.sectionDesc, { fontSize: fs(13) }]}>
            Nhấn nút bên dưới để chuyển nhanh sang giao diện Người cao tuổi (Elderly App):
          </Text>
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={handleSwitchToElderly}
            disabled={switchingRole}
            activeOpacity={0.8}
          >
            {switchingRole ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Feather name="user" size={16} color={colors.textInverse} />
                <Text style={[styles.switchRoleText, { fontSize: fs(13.5) }]}>
                  Chuyển sang vai trò: Người cao tuổi
                </Text>
              </>
            )}
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
          <Feather name="log-out" size={16} color={colors.dangerText} />
          <Text style={[styles.logoutText, { fontSize: fs(14) }]}>
            Đăng xuất khỏi tài khoản
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Link Elderly Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeLinkModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { fontSize: fs(18) }]}>
                Liên kết người cao tuổi mới
              </Text>
              <TouchableOpacity
                onPress={closeLinkModal}
                disabled={linking}
                activeOpacity={0.7}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng hộp thoại"
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, { fontSize: fs(12.5) }]}>
              Nhập tên đăng nhập tài khoản của người thân để đồng bộ sức khỏe và nhắc nhở uống thuốc.
            </Text>

            <Text style={[styles.modalLabel, { fontSize: fs(13) }]}>
              Tên đăng nhập của cụ *
            </Text>
            <View style={styles.modalInputWrap}>
              <Feather name="at-sign" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.modalInput, { fontSize: fs(14) }]}
                placeholder="Ví dụ: ong_ba hoặc huyn"
                value={elderlyUsername}
                onChangeText={setElderlyUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
                editable={!linking}
              />
            </View>

            <Text style={[styles.modalLabel, { fontSize: fs(13) }]}>Mối quan hệ *</Text>
            <View style={styles.presetRow}>
              {RELATIONSHIP_PRESETS.map((preset) => {
                const isSelected = relationship.trim() === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => setRelationship(preset)}
                    disabled={linking}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { fontSize: fs(12.5) },
                        isSelected && styles.presetChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalInputWrap}>
              <Feather name="heart" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.modalInput, { fontSize: fs(14) }]}
                placeholder="Hoặc nhập mối quan hệ khác (VD: Bác, Cô...)"
                value={relationship}
                onChangeText={setRelationship}
                placeholderTextColor={colors.textMuted}
                editable={!linking}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeLinkModal}
                disabled={linking}
                activeOpacity={0.75}
              >
                <Text style={[styles.cancelBtnText, { fontSize: fs(14) }]}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, linking && styles.saveBtnDisabled]}
                onPress={handleLink}
                disabled={linking}
                activeOpacity={0.8}
              >
                {linking ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={[styles.saveBtnText, { fontSize: fs(14) }]}>Tạo kết nối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 110,
    gap: 14,
  },
  subContentContainer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 110,
    gap: 14,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  subHeaderTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  subHeaderSpacer: {
    width: 38,
  },
  profileCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    ...shadows.subtle,
  },
  editProfileBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 10,
  },
  userName: {
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  userUsername: {
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rolePillText: {
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 1,
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  phoneText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  menuCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  menuRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  menuTextCol: {
    flex: 1,
    minWidth: 0,
  },
  menuTitleText: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  menuItemHint: {
    color: colors.textSecondary,
    marginTop: 2,
    flexShrink: 1,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  subSectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subSectionHint: {
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  avatarPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 4,
  },
  avatarPickItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceWarm,
    position: 'relative',
  },
  avatarPickItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  avatarPickImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  avatarCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  avatarPickLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  fieldLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputWrapDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  textInputReadonly: {
    color: colors.textSecondary,
  },
  eyeBtn: {
    padding: 8,
  },
  readonlyBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readonlyBadgeText: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  roleStaticRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  roleStaticLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    ...shadows.subtle,
  },
  primaryActionBtnText: {
    color: colors.textInverse,
    fontWeight: '800',
    textAlign: 'center',
  },
  displayBlock: {
    gap: 4,
  },
  displayHeading: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  displaySub: {
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  livePreviewCard: {
    backgroundColor: colors.accentLight,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  previewGreeting: {
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 10,
  },
  previewCurrentLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sliderContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 14,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  sliderTrackLine: {
    position: 'absolute',
    top: 31,
    left: '12%',
    right: '12%',
    height: 2.5,
    backgroundColor: colors.border,
  },
  sliderStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderStepItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  sliderDotBase: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  sliderDotInactive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textMuted,
    marginTop: 5,
    marginBottom: 13,
  },
  sliderDotActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  sliderDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textInverse,
  },
  sliderStepText: {
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  sliderStepTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  toggleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentBtn: {
    flex: 1,
    minWidth: 0,
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
  securityCommitmentBox: {
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commitmentIcon: {
    marginRight: 8,
  },
  commitmentTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontWeight: '800',
    color: colors.successText,
  },
  commitmentDesc: {
    color: colors.successText,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  sectionDesc: {
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 19,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: {
    fontWeight: '700',
    color: colors.textInverse,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyBox: {
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '700',
  },
  memberList: {
    gap: 12,
  },
  memberCard: {
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberName: {
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  memberMeta: {
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  memberPhone: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  connectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  connectedText: {
    fontWeight: '700',
    color: colors.successText,
  },
  permissionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%',
  },
  permissionTagAllowed: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.borderLight,
  },
  permissionTagLimited: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  permissionText: {
    fontWeight: '600',
    flexShrink: 1,
  },
  permissionTextAllowed: {
    color: colors.primary,
  },
  permissionTextLimited: {
    color: colors.textSecondary,
  },
  memberActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  unlinkBtnText: {
    fontWeight: '700',
    color: colors.dangerText,
  },
  demoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  switchRoleText: {
    fontWeight: '800',
    color: colors.textInverse,
    flexShrink: 1,
    textAlign: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  logoutText: {
    fontWeight: '800',
    color: colors.dangerText,
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.58)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.elevated,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalHint: {
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  modalLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    color: colors.textPrimary,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    fontWeight: '700',
    color: colors.primary,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
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
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontWeight: '800',
    color: colors.textInverse,
  },
});
