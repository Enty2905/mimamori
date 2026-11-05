import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../core/theme/colors';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';
import { AuthScreen } from '../features/auth/AuthScreen';

// Elderly Screens
import { ElderlyHomeScreen } from '../features/elderly/ElderlyHomeScreen';
import { ElderlyCompanionScreen } from '../features/elderly/ElderlyCompanionScreen';
import { ElderlyMedicationScreen } from '../features/elderly/ElderlyMedicationScreen';
import { ElderlyCheckInScreen } from '../features/elderly/ElderlyCheckInScreen';
import { ElderlyProfileScreen } from '../features/elderly/ElderlyProfileScreen';

// Caregiver Screens
import { CaregiverDashboardScreen } from '../features/caregiver/CaregiverDashboardScreen';
import { CaregiverAlertsScreen } from '../features/caregiver/CaregiverAlertsScreen';
import { CaregiverFamilyScreen } from '../features/caregiver/CaregiverFamilyScreen';

export default function IndexRoute() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { fs } = useAccessibilityStore();
  const [elderlyTab, setElderlyTab] = useState<'home' | 'medication' | 'companion' | 'checkin' | 'profile'>('home');
  const [caregiverTab, setCaregiverTab] = useState<'dashboard' | 'alerts' | 'medication' | 'family'>('dashboard');

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <View style={styles.loadingCard}>
          <Image
            source={require('../../assets/images/mimamori-leaf-icon.png')}
            style={{ width: 68, height: 68, marginBottom: 10 }}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 14 }} />
          <Text style={[styles.loadingTitle, { fontSize: fs(22) }]}>Mimamori AI</Text>
          <Text style={[styles.loadingSub, { fontSize: fs(13) }]}>
            Đang kết nối nền tảng chăm sóc Mimamori...
          </Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  const isElderly = user.role === 'ELDERLY';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Main Content Area */}
      <View style={styles.content}>
        {isElderly ? (
          <>
            {elderlyTab === 'home' && <ElderlyHomeScreen onNavigateTab={setElderlyTab} />}
            {elderlyTab === 'medication' && <ElderlyMedicationScreen />}
            {elderlyTab === 'companion' && <ElderlyCompanionScreen />}
            {elderlyTab === 'checkin' && <ElderlyCheckInScreen onSuccess={() => setElderlyTab('home')} />}
            {elderlyTab === 'profile' && <ElderlyProfileScreen />}
          </>
        ) : (
          <>
            {caregiverTab === 'dashboard' && <CaregiverDashboardScreen onNavigateTab={(tab) => setCaregiverTab(tab as any)} />}
            {caregiverTab === 'alerts' && <CaregiverAlertsScreen />}
            {caregiverTab === 'medication' && <ElderlyMedicationScreen />}
            {caregiverTab === 'family' && <CaregiverFamilyScreen />}
          </>
        )}
      </View>

      {/* Eldora-Style Thin Vector Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {isElderly ? (
          <>
            {/* Tab 1: Trang chủ */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setElderlyTab('home')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: elderlyTab === 'home' }}
            >
              <Feather
                name="home"
                size={21}
                color={elderlyTab === 'home' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  elderlyTab === 'home' && styles.navLabelActive,
                ]}
              >
                Trang chủ
              </Text>
              {elderlyTab === 'home' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Tab 2: AI */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setElderlyTab('companion')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: elderlyTab === 'companion' }}
            >
              <Feather
                name="message-circle"
                size={21}
                color={elderlyTab === 'companion' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  elderlyTab === 'companion' && styles.navLabelActive,
                ]}
              >
                AI
              </Text>
              {elderlyTab === 'companion' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Tab 3: Thuốc */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setElderlyTab('medication')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: elderlyTab === 'medication' }}
            >
              <MaterialCommunityIcons
                name="pill"
                size={22}
                color={elderlyTab === 'medication' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  elderlyTab === 'medication' && styles.navLabelActive,
                ]}
              >
                Thuốc
              </Text>
              {elderlyTab === 'medication' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Tab 4: Điểm danh */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setElderlyTab('checkin')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: elderlyTab === 'checkin' }}
            >
              <Feather
                name="check-square"
                size={21}
                color={elderlyTab === 'checkin' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  elderlyTab === 'checkin' && styles.navLabelActive,
                ]}
              >
                Điểm danh
              </Text>
              {elderlyTab === 'checkin' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Tab 5: Hồ sơ */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setElderlyTab('profile')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: elderlyTab === 'profile' }}
            >
              <Feather
                name="user"
                size={21}
                color={elderlyTab === 'profile' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  elderlyTab === 'profile' && styles.navLabelActive,
                ]}
              >
                Hồ sơ
              </Text>
              {elderlyTab === 'profile' && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCaregiverTab('dashboard')}
              activeOpacity={0.7}
            >
              <Feather
                name="activity"
                size={21}
                color={caregiverTab === 'dashboard' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  caregiverTab === 'dashboard' && styles.navLabelActive,
                ]}
              >
                Giám sát
              </Text>
              {caregiverTab === 'dashboard' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCaregiverTab('alerts')}
              activeOpacity={0.7}
            >
              <Feather
                name="alert-triangle"
                size={21}
                color={caregiverTab === 'alerts' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  caregiverTab === 'alerts' && styles.navLabelActive,
                ]}
              >
                Cảnh báo
              </Text>
              {caregiverTab === 'alerts' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCaregiverTab('medication')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="pill"
                size={22}
                color={caregiverTab === 'medication' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  caregiverTab === 'medication' && styles.navLabelActive,
                ]}
              >
                Lịch thuốc
              </Text>
              {caregiverTab === 'medication' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCaregiverTab('family')}
              activeOpacity={0.7}
            >
              <Feather
                name="users"
                size={21}
                color={caregiverTab === 'family' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { fontSize: fs(11.5) },
                  caregiverTab === 'family' && styles.navLabelActive,
                ]}
              >
                Gia đình
              </Text>
              {caregiverTab === 'family' && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  appLogoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLogoText: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.primary,
  },
  loadingTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  loadingSub: {
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadows.subtle,
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navIconText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  navIconTextActive: {
    color: colors.primary,
    fontWeight: '900',
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 3,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
});
