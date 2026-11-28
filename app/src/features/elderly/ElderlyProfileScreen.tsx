import {useForm,useWatch} from 'react-hook-form';
import {profileFields} from '../../core/auth/forms';
import {isRunningInExpoGo} from 'expo';
import {useOriginalLabels} from '../../core/localization/original';
import {useColors,useThemeStore} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React, { useEffect, useState } from 'react';
import {
  View,
    StyleSheet,
  ScrollView,
    Switch,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../../core/theme/colors';
import { useSession } from '../../core/auth/useSession';
import {careApi} from '../../core/api/careApi';
import {useFamily} from '../caregiver/queries';
import {FamilyLinks} from '../caregiver/FamilyLinks';
import {Notice,LanguageControl} from '../../components/CareUI';
import {useReminderStatus} from '../../core/notifications/runtime';
import {useTranslation} from 'react-i18next';
import { AVATAR_PRESETS, getAvatarSource } from '../../core/theme/avatar';
import {
  useAccessibilityStore,
  FONT_SIZE_OPTIONS,
  FontSizeLevel,
} from '../../core/accessibility/useAccessibilityStore';

export const ElderlyProfileScreen: React.FC = () => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { user, logout, demoLogin, updateUser } = useSession();
  const { fontSizeLevel, setFontSizeLevel, fs } = useAccessibilityStore();
  const family=useFamily();
  const familyMembers=family.data?.filter(item=>item.status==='ACCEPTED') ?? [];
  const {t}=useTranslation();
  const reminders=useReminderStatus();
  const [currentSubView, setCurrentSubView] = useState<'main' | 'displaySettings' | 'personalInfo' | 'securityPrivacy'>('main');

  // Accessibility & Display toggles (Screen 9)
  const display = useThemeStore();
  const highContrast=display.highContrast;
  const darkMode=display.darkMode;
  const setHighContrast=(value:boolean)=>display.set({highContrast:value});
  const setDarkMode=(value:boolean)=>display.set({darkMode:value});

  // Form: Thông tin cá nhân
  const form=useForm<{fullName:string;phone:string;emergencyPhone:string;selectedAvatarId:string}>({defaultValues:{fullName:user?.fullName??'',phone:user?.phone??'',emergencyPhone:user?.emergencyContact??'',selectedAvatarId:user?.avatarUrl??'watering'}});
  const {fullName='',phone='',emergencyPhone='',selectedAvatarId='watering'}=useWatch({control:form.control});
  const setFullName=(value:string)=>form.setValue('fullName',value);
  const setPhone=(value:string)=>form.setValue('phone',value);
  const setEmergencyPhone=(value:string)=>form.setValue('emergencyPhone',value);
  const setSelectedAvatarId=(value:string)=>form.setValue('selectedAvatarId',value);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form: Đổi mật khẩu
  const [securityTab, setSecurityTab] = useState<'change' | 'forgot'>('change');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const {reset}=form;
  useEffect(()=>{if(user)reset({fullName:user.fullName,phone:user.phone??'',emergencyPhone:user.emergencyContact??'',selectedAvatarId:user.avatarUrl??'watering'});},[user,reset]);

  const currentFontOption =
    FONT_SIZE_OPTIONS.find((o) => o.id === fontSizeLevel) || FONT_SIZE_OPTIONS[1];

  const getShortFontLabel = (id: FontSizeLevel) => {
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

  // Handler: Lưu thông tin cá nhân
  const handleSaveProfile = async () => {
    if (!profileFields.safeParse(form.getValues()).success) {
      Alert.alert(tr("Lưu ý"), tr("Vui lòng nhập họ và tên của cụ."));
      return;
    }

    try {
      setSavingProfile(true);
      const saved=await careApi.saveProfile({fullName:fullName.trim(),phone:phone.trim(),emergencyContact:emergencyPhone.trim(),avatarUrl:selectedAvatarId});
      updateUser(saved);
      {
        Alert.alert(tr("Thành công"), tr("Thông tin cá nhân của cụ đã được lưu lại thành công!"));
        setCurrentSubView('main');
      }
    } catch (err: unknown) {
      Alert.alert(tr("Lỗi"), (err instanceof Error ? err.message : '') || 'Không thể lưu thông tin lúc này.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handler: Đổi mật khẩu
  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert(tr("Lưu ý"), tr("Vui lòng nhập mật khẩu hiện tại."));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(tr("Lưu ý"), tr("Mật khẩu mới phải có ít nhất 6 ký tự."));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(tr("Lưu ý"), tr("Xác nhận mật khẩu mới không khớp."));
      return;
    }

    try {
      setSavingPassword(true);
      await careApi.changePassword(currentPassword,newPassword);
      await logout();
      {
        Alert.alert(tr("Thành công"), tr("Đổi mật khẩu tài khoản thành công!"));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setCurrentSubView('main');
      }
    } catch (err: unknown) {
      Alert.alert(tr("Lỗi"), (err instanceof Error ? err.message : '') || 'Không thể đổi mật khẩu lúc này.');
    } finally {
      setSavingPassword(false);
    }
  };

  // ==========================================
  // VIEW 4: BẢO MẬT & QUYỀN RIÊNG TƯ
  // ==========================================
  if (currentSubView === 'securityPrivacy') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            style={styles.backBtnCircle}
            onPress={() => setCurrentSubView('main')}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.screenHeaderTitle, { fontSize: fs(20) }]}>{tr("Bảo mật & Quyền riêng tư")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Security Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, securityTab === 'change' && styles.segmentBtnActive]}
            onPress={() => setSecurityTab('change')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { fontSize: fs(13.5) },
                securityTab === 'change' && styles.segmentTextActive,
              ]}
            >{tr("Đổi mật khẩu")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, securityTab === 'forgot' && styles.segmentBtnActive]}
            onPress={() => setSecurityTab('forgot')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { fontSize: fs(13.5) },
                securityTab === 'forgot' && styles.segmentTextActive,
              ]}
            >{tr("Quên mật khẩu")}</Text>
          </TouchableOpacity>
        </View>

        {securityTab === 'change' ? (
          /* TAB 1: ĐỔI MẬT KHẨU */
          <View style={styles.cardBox}>
            <Text style={[styles.boxTitle, { fontSize: fs(20) }]}>{tr("Cập nhật mật khẩu mới")}</Text>
            <Text style={[styles.boxSubtitle, { fontSize: fs(12.5) }]}>{tr("Đặt mật khẩu an toàn có ít nhất 6 ký tự để bảo vệ tài khoản.")}</Text>

            {/* Mật khẩu hiện tại */}
            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Mật khẩu hiện tại *")}</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
              <TextInput
                style={[styles.textInput, { fontSize: fs(20) }]}
                placeholder={tr("Nhập mật khẩu đang dùng")}
                secureTextEntry={!showCurrentPw}
                accessibilityLabel={tr('Mật khẩu hiện tại *')}
                  value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPw(!showCurrentPw)}
                style={styles.eyeBtn}
              >
                <Feather name={showCurrentPw ? 'eye' : 'eye-off'} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Mật khẩu mới */}
            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Mật khẩu mới *")}</Text>
            <View style={styles.inputWrap}>
              <Feather name="shield" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
              <TextInput
                style={[styles.textInput, { fontSize: fs(20) }]}
                placeholder={tr("Ít nhất 6 ký tự")}
                secureTextEntry={!showNewPw}
                accessibilityLabel={tr('Mật khẩu mới *')}
                  value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setShowNewPw(!showNewPw)}
                style={styles.eyeBtn}
              >
                <Feather name={showNewPw ? 'eye' : 'eye-off'} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Xác nhận mật khẩu mới */}
            <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Xác nhận mật khẩu mới *")}</Text>
            <View style={styles.inputWrap}>
              <Feather name="check" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
              <TextInput
                style={[styles.textInput, { fontSize: fs(20) }]}
                placeholder={tr("Nhập lại mật khẩu mới")}
                secureTextEntry={!showNewPw}
                accessibilityLabel={tr('Xác nhận mật khẩu mới *')}
                  value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleChangePassword}
              disabled={savingPassword}
              activeOpacity={0.8}
            >
              {savingPassword ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={[styles.primaryActionBtnText, { fontSize: fs(20) }]}>{tr("Lưu mật khẩu mới")}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Notice text={t("recovery")} />
        )}

        {/* Security Commitment Box */}
        <View style={styles.securityCommitmentBox}>
          <View style={styles.commitmentHeader}>
            <Feather name="shield" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.commitmentTitle, { fontSize: fs(14) }]}>{tr("Bảo mật & Quyền truy cập")}</Text>
          </View>
          <Text style={[styles.commitmentDesc, { fontSize: fs(12.5) }]}>{tr("• Lưu ý bảo vệ thông tin sức khỏe và không chia sẻ mật khẩu.")}{'\n'}{tr("• Chỉ người thân được cấp phép liên kết mới xem được thông tin nhắc thuốc và điểm danh của cụ.")}{'\n'}{tr("• Người thân cần được cụ đồng ý liên kết trước khi truy cập dữ liệu.")}</Text>
        </View>
      </ScrollView>
    );
  }

  // ==========================================
  // VIEW 3: THÔNG TIN CÁ NHÂN (XEM & SỬA)
  // ==========================================
  if (currentSubView === 'personalInfo') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            style={styles.backBtnCircle}
            onPress={() => setCurrentSubView('main')}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.screenHeaderTitle, { fontSize: fs(20) }]}>{tr("Thông tin cá nhân")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar Selection Card */}
        <View style={styles.cardBox}>
          <Text style={[styles.boxTitle, { fontSize: fs(20) }]}>{tr("Ảnh đại diện")}</Text>
          <Text style={[styles.boxSubtitle, { fontSize: fs(12.5) }]}>{tr("Chọn hình đại diện thân thiện, dễ nhận diện:")}</Text>

          <View style={styles.avatarPickerRow}>
            {AVATAR_PRESETS.map((preset) => {
              const isSelected = selectedAvatarId === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.avatarPickItem, isSelected && styles.avatarPickItemActive]}
                  onPress={() => setSelectedAvatarId(preset.id)}
                  activeOpacity={0.7}
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
                      { fontSize: fs(11.5) },
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

        {/* Personal Details Form */}
        <View style={styles.cardBox}>
          <Text style={[styles.boxTitle, { fontSize: fs(20) }]}>{tr("Hồ sơ người cao tuổi")}</Text>

          {/* Họ và tên */}
          <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Họ và tên của cụ *")}</Text>
          <View style={styles.inputWrap}>
            <Feather name="user" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
            <TextInput
              style={[styles.textInput, { fontSize: fs(20) }]}
              placeholder={tr("Ví dụ: Nguyễn Văn Ba")}
              accessibilityLabel={tr('Họ và tên *')}
                  value={fullName}
              onChangeText={setFullName}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Tên đăng nhập (Read only) */}
          <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Tên tài khoản")}</Text>
          <View style={[styles.inputWrap, styles.inputWrapDisabled]}>
            <Feather name="at-sign" size={16} color={colors.textSecondary} style={styles.inputPrefixIcon} />
            <TextInput
              style={[styles.textInput, { fontSize: fs(20), color: colors.textSecondary }]}
              value={`@${user?.username || 'BaNguyen'}`}
              editable={false}
            />
            <View style={styles.readonlyBadge}>
              <Text style={styles.readonlyBadgeText}>{tr("Mặc định")}</Text>
            </View>
          </View>

          {/* Số điện thoại cụ */}
          <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Số điện thoại của cụ")}</Text>
          <View style={styles.inputWrap}>
            <Feather name="phone" size={16} color={colors.primary} style={styles.inputPrefixIcon} />
            <TextInput
              style={[styles.textInput, { fontSize: fs(20) }]}
              placeholder={tr("Ví dụ: 0912 345 678")}
              accessibilityLabel={tr('Số điện thoại')}
                  value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Số điện thoại khẩn cấp (Con cháu/Người thân) */}
          <Text style={[styles.fieldLabel, { fontSize: fs(13.5) }]}>{tr("Số điện thoại khẩn cấp (Con cái / Người thân)")}</Text>
          <View style={styles.inputWrap}>
            <Feather name="phone-call" size={16} color={colors.background === baseColors.background ? "#B83232" : colors.primary} style={styles.inputPrefixIcon} />
            <TextInput
              style={[styles.textInput, { fontSize: fs(20) }]}
              placeholder={tr("Ví dụ: 0987 654 321 (Con gái)")}
              accessibilityLabel={tr('Số điện thoại khẩn cấp (Con cái / Người thân)')}
                  value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Vai trò */}
          <View style={styles.roleStaticRow}>
            <Text style={[styles.roleStaticLabel, { fontSize: fs(13) }]}>{tr("Vai trò trong hệ thống:")}</Text>
            <View style={styles.heroRolePill}>
              <Text style={[styles.heroRoleText, { fontSize: fs(11.5) }]}>{tr("Người cao tuổi (ELDERLY)")}</Text>
            </View>
          </View>

          {/* Nút lưu thay đổi */}
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            activeOpacity={0.8}
          >
            {savingProfile ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={[styles.primaryActionBtnText, { fontSize: fs(20) }]}>{tr("Lưu thông tin cá nhân")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ==========================================
  // VIEW 2: SCREEN 9 - CÀI ĐẶT HIỂN THỊ
  // ==========================================
  if (currentSubView === 'displaySettings') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            style={styles.backBtnCircle}
            onPress={() => setCurrentSubView('main')}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.screenHeaderTitle, { fontSize: fs(20) }]}>{tr("Cài đặt hiển thị")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.displaySectionBlock}>
          <Text style={[styles.displaySectionHeading, { fontSize: fs(20) }]}>{tr("Cỡ chữ hiển thị")}</Text>
          <Text style={[styles.displaySectionSub, { fontSize: fs(13.5) }]}>{tr("Điều chỉnh cỡ chữ để đọc dễ dàng hơn")}</Text>

          {/* Live Preview Card */}
          <View style={styles.livePreviewCard}>
            <Text style={[styles.previewGreeting, { fontSize: fs(20) }]}>{tr("Xin chào ông/bà!")}{'\n'}{tr("Hôm nay ông/bà cảm thấy thế nào?")}</Text>
            <Text style={[styles.previewCurrentLabel, { fontSize: fs(12.5) }]}>{tr("Cỡ chữ hiện tại: ")}{tr(currentFontOption.label)}
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
                    onPress={() => setFontSizeLevel(opt.id as FontSizeLevel)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
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
                        { fontSize: fs(13) },
                        isSelected && styles.sliderStepTextActive,
                      ]}
                    >
                      {tr(getShortFontLabel(opt.id))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <LanguageControl />
        {/* Display Toggles */}
        <View style={styles.menuCard}>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleTitle, { fontSize: fs(20) }]}>{tr("Tăng độ tương phản")}</Text>
            <Switch
              accessibilityLabel={tr("Tăng độ tương phản")}
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: '#D1D5DB', true: '#456B58' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.toggleTitle, { fontSize: fs(20) }]}>{tr("Chế độ ban đêm")}</Text>
            <Switch
              accessibilityLabel={tr("Chế độ ban đêm")}
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#D1D5DB', true: '#456B58' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveSettingsBtn}
          onPress={() => setCurrentSubView('main')}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveSettingsBtnText, { fontSize: fs(20) }]}>{tr("Áp dụng & Quay lại")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ==========================================
  // VIEW 1: SCREEN 8 - HỒ SƠ CÁ NHÂN
  // ==========================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Bar with Gear on Left and Title */}
      <View style={styles.topHeaderRow}>
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={() => setCurrentSubView('displaySettings')}
          activeOpacity={0.7}
        >
          <Feather name="settings" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.screenHeaderTitle, { fontSize: fs(20) }]}>{tr("Hồ sơ")}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Screen 8: Profile Hero Row */}
      <View style={styles.profileHeroRow}>
        <TouchableOpacity
          style={styles.seniorPhotoCircle}
          onPress={() => setCurrentSubView('personalInfo')}
          activeOpacity={0.8}
        >
          <Image
            source={getAvatarSource(user?.avatarUrl || selectedAvatarId)}
            style={styles.seniorPhotoImg}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.profileHeroInfo}>
          <Text style={[styles.heroNameText, { fontSize: fs(20) }]}>
            {user?.fullName || fullName}
          </Text>
          <Text style={[styles.heroUsernameText, { fontSize: fs(13.5) }]}>{tr("@")}{user?.username || 'BaNguyen'} {user?.phone ? `• ${user.phone}` : ''}
          </Text>
          <View style={styles.heroRolePill}>
            <Text style={[styles.heroRoleText, { fontSize: fs(11.5) }]}>{tr("Người cao tuổi")}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editHeroPencil}
          onPress={() => setCurrentSubView('personalInfo')}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={15} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Screen 8: Clean Menu List */}
      <View style={styles.menuCard}>
        {/* Item 1: Thông tin cá nhân (Tap to open Personal Info Form) */}
        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => setCurrentSubView('personalInfo')}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="user" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Thông tin cá nhân")}</Text>
              <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>{tr("Đổi ảnh đại diện, số điện thoại")}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Item 2: Người thân kết nối */}
        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => {
            const count = familyMembers.length;
            Alert.alert(
              tr("Người thân kết nối chăm sóc"),
              `Đang có ${count} người thân liên kết nhận cảnh báo và điểm danh hàng ngày.`
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="users" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Người thân kết nối")}</Text>
          </View>
          <View style={styles.menuRightRow}>
            <View style={styles.miniAvatarGroup}>
              <View style={[styles.miniAvatar, { backgroundColor: colors.background === baseColors.background ? '#FDE68A' : colors.surfaceWarm }]}>
                <Feather name="user" size={11} color={colors.background === baseColors.background ? "#92400E" : colors.primary} />
              </View>
              <View style={[styles.miniAvatar, { backgroundColor: colors.background === baseColors.background ? '#BFDBFE' : colors.surfaceWarm, marginLeft: -6 }]}>
                <Feather name="user" size={11} color={colors.background === baseColors.background ? "#1E40AF" : colors.primary} />
              </View>
              <View style={[styles.miniAvatar, { backgroundColor: colors.background === baseColors.background ? '#BBF7D0' : colors.surfaceWarm, marginLeft: -6 }]}>
                <Feather name="user" size={11} color={colors.background === baseColors.background ? "#166534" : colors.primary} />
              </View>
            </View>
            <Text style={[styles.menuRightSubtext, { fontSize: fs(13) }]}>
              {familyMembers.length}{tr(" người")}</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        {/* Item 3: Cài đặt hiển thị (Tap to open Screen 9) */}
        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => setCurrentSubView('displaySettings')}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="sliders" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Cài đặt hiển thị")}</Text>
          </View>
          <View style={styles.menuRightRow}>
            <Text style={[styles.menuRightSubtext, { fontSize: fs(13) }]}>{tr("Cỡ chữ: ")}{tr(getShortFontLabel(fontSizeLevel))}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        {/* Item 4: Thông báo */}
        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => {void reminders.enable();}}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="bell" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Thông báo")}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Item 5: Bảo mật & Quyền riêng tư (Tap to open Security & Password Form) */}
        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => setCurrentSubView('securityPrivacy')}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="shield" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Bảo mật & Quyền riêng tư")}</Text>
              <Text style={[styles.menuItemHint, { fontSize: fs(12) }]}>{tr("Đổi mật khẩu, khôi phục tài khoản")}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Item 6: Trợ giúp */}
        <TouchableOpacity
          style={[styles.menuRowItem, { borderBottomWidth: 0 }]}
          onPress={() => {
            Alert.alert(
              tr("Trợ giúp & Hỗ trợ"),
              tr("Nếu cụ cần hỗ trợ sử dụng ứng dụng hoặc khẩn cấp, vui lòng nhấn nút SOS hoặc liên hệ người thân.")
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeftCol}>
            <View style={styles.menuIconBox}>
              <Feather name="help-circle" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuTitleText, { fontSize: fs(20) }]}>{tr("Trợ giúp")}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Screen 8: Soft Red / Peach Pill Logout Button */}
      <TouchableOpacity
        style={styles.screen8LogoutBtn}
        onPress={() => {
          Alert.alert(tr("Đăng xuất"), tr("Cụ có chắc chắn muốn đăng xuất tài khoản không?"), [
            { text: tr("Hủy bỏ"), style: 'cancel' },
            { text: tr("Đăng xuất"), style: 'destructive', onPress: () => logout() },
          ]);
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.screen8LogoutBtnText, { fontSize: fs(20) }]}>{tr("Đăng xuất")}</Text>
      </TouchableOpacity>

      <FamilyLinks />
      <Notice text={t(isRunningInExpoGo() ? 'previewNotifications' : reminders.status === "ready" ? "notificationsReady" : reminders.status === "limited" ? "notificationsLimited" : "notificationsOff")} />
      {/* Discreet Demo Switcher */}
      {process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && <View style={styles.demoSectionCard}>
        <Text style={styles.demoSectionBadge}>{tr("DÀNH CHO HỘI ĐỒNG BẢO VỆ / THỬ NGHIỆM")}</Text>
        <Text style={[styles.demoSectionTitle, { fontSize: fs(13.5) }]}>{tr("Chuyển sang giao diện Người chăm sóc")}</Text>
        <TouchableOpacity
          style={styles.switchRoleBtn}
          onPress={() => demoLogin('CAREGIVER')}
          activeOpacity={0.8}
        >
          <Feather name="repeat" size={15} color={colors.textInverse} style={{ marginRight: 6 }} />
          <Text style={[styles.switchRoleBtnText, { fontSize: fs(13) }]}>{tr("Chuyển vai trò: Người chăm sóc")}</Text>
        </TouchableOpacity>
      </View>}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  gearBtn: {
    width: 38,
    minHeight: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnCircle: {
    width: 38,
    minHeight: 56,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  screenHeaderTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },

  // Screen 8 Hero Row
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  seniorPhotoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: colors.background === baseColors.background ? '#E6EEE7' : colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.background === baseColors.background ? '#456B58' : colors.border,
    marginRight: 14,
  },
  seniorPhotoImg: {
    width: '100%',
    height: '100%',
  },
  profileHeroInfo: {
    flex: 1,
  },
  heroNameText: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  heroUsernameText: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  heroRolePill: {
    backgroundColor: colors.background === baseColors.background ? '#E6EEE7' : colors.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  heroRoleText: {
    fontWeight: '700',
    color: colors.background === baseColors.background ? '#456B58' : colors.textPrimary,
  },
  editHeroPencil: {
    width: 32,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.background === baseColors.background ? '#F3F6F4' : colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Menu List
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  menuRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconBox: {
    width: 32,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.background === baseColors.background ? '#F3F6F4' : colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitleText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuItemHint: {
    color: colors.textMuted,
    marginTop: 2,
  },
  menuRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuRightSubtext: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  miniAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.background === baseColors.background ? '#FFFFFF' : colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Screen 8 Logout Button
  screen8LogoutBtn: {
    backgroundColor: colors.background === baseColors.background ? '#FDE8E8' : colors.surfaceWarm,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  screen8LogoutBtnText: {
    fontWeight: '800',
    color: colors.background === baseColors.background ? '#C53030' : colors.textPrimary,
  },

  // Form / Card Boxes
  cardBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  boxTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  boxSubtitle: {
    color: colors.textSecondary,
    marginBottom: 14,
  },
  fieldLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 10,
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
    backgroundColor: colors.background === baseColors.background ? '#F3F4F6' : colors.surfaceWarm,
    borderColor: colors.background === baseColors.background ? '#E5E7EB' : colors.border,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  eyeBtn: {
    padding: 8,
  },
  readonlyBadge: {
    backgroundColor: colors.background === baseColors.background ? '#E5E7EB' : colors.surfaceWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readonlyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  roleStaticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  roleStaticLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  primaryActionBtn: {
    backgroundColor: colors.background === baseColors.background ? '#456B58' : colors.surfaceWarm,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...shadows.subtle,
  },
  primaryActionBtnText: {
    color: colors.textInverse,
    fontWeight: '800',
  },

  // Avatar Picker
  avatarPickerRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  avatarPickItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarPickItemActive: {
    borderColor: colors.background === baseColors.background ? '#456B58' : colors.border,
    backgroundColor: colors.background === baseColors.background ? '#E6EEE7' : colors.surfaceWarm,
  },
  avatarPickImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 6,
  },
  avatarCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background === baseColors.background ? '#456B58' : colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  avatarPickLabelActive: {
    color: colors.background === baseColors.background ? '#456B58' : colors.textPrimary,
    fontWeight: '800',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.background === baseColors.background ? '#456B58' : colors.textPrimary,
    fontWeight: '800',
  },

  // Security Commitment
  securityCommitmentBox: {
    backgroundColor: colors.background === baseColors.background ? '#F0FDF4' : colors.surfaceWarm,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.background === baseColors.background ? '#BBF7D0' : colors.border,
    marginBottom: 16,
  },
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commitmentTitle: {
    fontWeight: '800',
    color: colors.background === baseColors.background ? '#166534' : colors.textPrimary,
  },
  commitmentDesc: {
    color: colors.background === baseColors.background ? '#15803D' : colors.textPrimary,

  },

  // Screen 9 Elements
  displaySectionBlock: {
    marginBottom: 16,
  },
  displaySectionHeading: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  displaySectionSub: {
    color: colors.textSecondary,
    marginBottom: 16,
  },
  livePreviewCard: {
    backgroundColor: colors.background === baseColors.background ? '#FFFBF4' : colors.surfaceWarm,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.background === baseColors.background ? '#EFE8D8' : colors.border,
    ...shadows.subtle,
  },
  previewGreeting: {
    color: colors.textPrimary,
    fontWeight: '700',

    marginBottom: 12,
  },
  previewCurrentLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sliderContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
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
    backgroundColor: colors.background === baseColors.background ? '#D1D5DB' : colors.surfaceWarm,
  },
  sliderStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderStepItem: {
    alignItems: 'center',
    minWidth: 54,
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
    backgroundColor: colors.background === baseColors.background ? '#9CA3AF' : colors.surfaceWarm,
    marginTop: 5,
    marginBottom: 13,
  },
  sliderDotActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background === baseColors.background ? '#456B58' : colors.surfaceWarm,
  },
  sliderDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  sliderStepText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sliderStepTextActive: {
    color: colors.background === baseColors.background ? '#456B58' : colors.textPrimary,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  toggleTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveSettingsBtn: {
    backgroundColor: colors.background === baseColors.background ? '#456B58' : colors.surfaceWarm,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...shadows.subtle,
  },
  saveSettingsBtnText: {
    color: colors.textInverse,
    fontWeight: '800',
  },

  // Demo Box
  demoSectionCard: {
    backgroundColor: colors.background === baseColors.background ? '#F5F3FF' : colors.surfaceWarm,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.background === baseColors.background ? '#DDD6FE' : colors.border,
  },
  demoSectionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.background === baseColors.background ? '#7C3AED' : colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  demoSectionTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background === baseColors.background ? '#7C3AED' : colors.surfaceWarm,
    borderRadius: 12,
    paddingVertical: 10,
  },
  switchRoleBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
  },
});
