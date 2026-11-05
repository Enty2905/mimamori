import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAuthStore, UserRole } from '../../core/auth/useAuthStore';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';

export const AuthScreen: React.FC = () => {
  const { login, register, demoLogin, isLoading, error, clearError } = useAuthStore();
  const { fs } = useAccessibilityStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('ELDERLY');
  const [phone, setPhone] = useState('');

  const handleSubmit = async () => {
    clearError();
    if (isRegisterMode) {
      if (!username || !password || !fullName || !email) {
        alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
        return;
      }
      await register({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        phoneNumber: phone.trim() || undefined,
      });
    } else {
      if (!username || !password) {
        alert('Vui lòng nhập tên đăng nhập và mật khẩu');
        return;
      }
      await login(username.trim(), password);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        contentContainerStyle={styles.welcomeScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Brand Header with Custom Mimamori Leaf Logo */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../../../assets/images/mimamori-leaf-icon.png')}
            style={styles.brandLeafLogo}
            resizeMode="contain"
          />
          <Text style={[styles.brandTitle, { fontSize: fs(24) }]}>Mimamori AI</Text>
        </View>

        {/* 2. Headline & Subtitle */}
        <View style={styles.headlineBlock}>
          <Text style={[styles.heroHeadline, { fontSize: fs(28) }]}>
            Chăm sóc kết nối.{'\n'}
            <Text style={styles.heroHeadlineGreen}>Điểm tựa yêu thương.</Text>
          </Text>
          <Text style={[styles.heroSubhead, { fontSize: fs(14) }]}>
            Người bạn đồng hành AI chu đáo và thấu cảm dành cho người cao tuổi cùng gia đình thân yêu.
          </Text>
        </View>

        {/* 3. Hero Portrait Card - Using User's Gardening Grandmother Photo */}
        <View style={styles.heroImageCard}>
          <Image
            source={require('../../../assets/images/hero-senior-watering.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroBadgeOverlay}>
            <Feather name="sun" size={14} color={colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.heroBadgeText}>Sống an vui mỗi ngày</Text>
          </View>
        </View>

        {/* 4. Three Eldora Value Pillars with Vector Icons */}
        <View style={styles.valuePillarsRow}>
          <View style={styles.valueCard}>
            <View style={styles.valueIconCircle}>
              <Feather name="heart" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.valueTitle, { fontSize: fs(13) }]}>Thấu cảm</Text>
            <Text style={[styles.valueSub, { fontSize: fs(11) }]}>Hỗ trợ sức khỏe & tinh thần</Text>
          </View>

          <View style={styles.valueCard}>
            <View style={styles.valueIconCircle}>
              <Feather name="users" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.valueTitle, { fontSize: fs(13) }]}>Kết nối</Text>
            <Text style={[styles.valueSub, { fontSize: fs(11) }]}>Gắn kết gia đình yêu thương</Text>
          </View>

          <View style={styles.valueCard}>
            <View style={styles.valueIconCircle}>
              <Feather name="shield" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.valueTitle, { fontSize: fs(13) }]}>Tự chủ</Text>
            <Text style={[styles.valueSub, { fontSize: fs(11) }]}>Duy trì nếp sống an vui</Text>
          </View>
        </View>

        {/* 5. Big Primary Action Button */}
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => {
            clearError();
            setShowAuthModal(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Bắt đầu trải nghiệm Mimamori"
        >
          <Text style={[styles.getStartedButtonText, { fontSize: fs(17) }]}>Bắt đầu trải nghiệm</Text>
        </TouchableOpacity>

        {/* 6. Secondary Quick Login Link */}
        <TouchableOpacity
          style={styles.signInLinkBtn}
          onPress={() => {
            clearError();
            setIsRegisterMode(false);
            setShowAuthModal(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.signInLinkText, { fontSize: fs(14) }]}>
            Đã có tài khoản? <Text style={styles.boldGreen}>Đăng nhập ngay</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Auth Bottom Sheet Modal */}
      <Modal visible={showAuthModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalTopBar}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowAuthModal(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* Demo 1-Tap Login Section */}
              <View style={styles.demoBox}>
                <View style={styles.demoKickerRow}>
                  <Feather name="zap" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.demoKicker, { fontSize: fs(11) }]}>
                    TRẢI NGHIỆM NHANH (1-CHẠM)
                  </Text>
                </View>

                <View style={styles.demoCardGrid}>
                  <TouchableOpacity
                    style={[styles.demoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                    onPress={() => {
                      setShowAuthModal(false);
                      demoLogin('ELDERLY');
                    }}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.demoIconCircle}>
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.demoCardTextCol}>
                      <Text style={[styles.demoCardTitle, { fontSize: fs(13.5) }]}>Người cao tuổi</Text>
                      <Text style={[styles.demoCardSub, { fontSize: fs(11.5) }]}>Cụ Ông Nguyễn Văn Ba</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.demoCard, { backgroundColor: colors.surfaceWarm, borderColor: colors.border }]}
                    onPress={() => {
                      setShowAuthModal(false);
                      demoLogin('CAREGIVER');
                    }}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.demoIconCircle}>
                      <Feather name="users" size={18} color={colors.primaryDark} />
                    </View>
                    <View style={styles.demoCardTextCol}>
                      <Text style={[styles.demoCardTitle, { fontSize: fs(13.5) }]}>Người chăm sóc</Text>
                      <Text style={[styles.demoCardSub, { fontSize: fs(11.5) }]}>Chị Nguyễn Thị Hoa</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={[styles.dividerText, { fontSize: fs(12) }]}>hoặc tài khoản cá nhân</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Form Tabs */}
              <View style={styles.tabToggleRow}>
                <TouchableOpacity
                  style={[styles.tabButton, !isRegisterMode && styles.tabButtonActive]}
                  onPress={() => {
                    setIsRegisterMode(false);
                    clearError();
                  }}
                >
                  <Text style={[styles.tabText, { fontSize: fs(14) }, !isRegisterMode && styles.tabTextActive]}>
                    Đăng nhập
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, isRegisterMode && styles.tabButtonActive]}
                  onPress={() => {
                    setIsRegisterMode(true);
                    clearError();
                  }}
                >
                  <Text style={[styles.tabText, { fontSize: fs(14) }, isRegisterMode && styles.tabTextActive]}>
                    Tạo tài khoản
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={16} color={colors.dangerText} style={{ marginRight: 6 }} />
                  <Text style={[styles.errorText, { fontSize: fs(13) }]}>{error}</Text>
                </View>
              ) : null}

              {/* Registration Extra Fields */}
              {isRegisterMode && (
                <>
                  <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>Họ và tên *</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="user" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.inputField, { fontSize: fs(15) }]}
                      placeholder="Ví dụ: Nguyễn Văn Ba"
                      placeholderTextColor={colors.textMuted}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>Email *</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="mail" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.inputField, { fontSize: fs(15) }]}
                      placeholder="email@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>Số điện thoại</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="phone" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.inputField, { fontSize: fs(15) }]}
                      placeholder="0912 345 678"
                      placeholderTextColor={colors.textMuted}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>Vai trò sử dụng *</Text>
                  <View style={styles.roleRow}>
                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'ELDERLY' && styles.roleBtnActive]}
                      onPress={() => setRole('ELDERLY')}
                    >
                      <Feather
                        name="user"
                        size={16}
                        color={role === 'ELDERLY' ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.roleBtnText, role === 'ELDERLY' && styles.roleBtnTextActive]}>
                        Người cao tuổi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'CAREGIVER' && styles.roleBtnActive]}
                      onPress={() => setRole('CAREGIVER')}
                    >
                      <Feather
                        name="users"
                        size={16}
                        color={role === 'CAREGIVER' ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.roleBtnText, role === 'CAREGIVER' && styles.roleBtnTextActive]}>
                        Người chăm sóc
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Standard Credentials Fields */}
              <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>
                {isRegisterMode ? 'Tên đăng nhập *' : 'Tên đăng nhập hoặc Email *'}
              </Text>
              <View style={styles.inputContainer}>
                <Feather name="at-sign" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputField, { fontSize: fs(15) }]}
                  placeholder="Nhập tên đăng nhập"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.inputLabel, { fontSize: fs(13) }]}>Mật khẩu *</Text>
              <View style={styles.inputContainer}>
                <Feather name="lock" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputField, { fontSize: fs(15) }]}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.submitButtonText, { fontSize: fs(16) }]}>
                    {isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập ngay'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeScroll: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 30,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandLeafLogo: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  brandLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  headlineBlock: {
    marginBottom: 18,
  },
  heroHeadline: {
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroHeadlineGreen: {
    color: colors.primary,
  },
  heroSubhead: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroImageCard: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surfaceWarm,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBadgeOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(255, 254, 252, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  heroBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  valuePillarsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  valueCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  valueIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  valueTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  valueSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  getStartedButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  signInLinkBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signInLinkText: {
    color: colors.textSecondary,
  },
  boldGreen: {
    fontWeight: '800',
    color: colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 51, 45, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    maxHeight: '92%',
    ...shadows.elevated,
  },
  modalTopBar: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBox: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  demoKicker: {
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  demoCardGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  demoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  demoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  demoCardTextCol: {
    alignItems: 'center',
  },
  demoCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  demoCardSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    color: colors.textMuted,
    marginHorizontal: 10,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  tabText: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorText: {
    flex: 1,
    color: colors.dangerText,
    fontWeight: '600',
  },
  inputLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surfaceWarm,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleBtnTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});