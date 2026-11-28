import {useOriginalLabels,checkinSummaryLabel} from '../../core/localization/original';
import {useColors} from '../../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from '../../components/CareText';
import React from 'react';
import {
  View,
    StyleSheet,
  ScrollView,
    ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as baseColors, shadows } from '../../core/theme/colors';
import { useSession } from '../../core/auth/useSession';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { useDoseList } from '../medication/queries';
import { useTodayCheckin } from '../navigation/queries';
import { DoseActions } from '../medication/DoseActions';
import { doseTime } from '../../core/config/time';
import { Notice, Button } from '../../components/CareUI';
import { SOSButton } from '../../components/SOSButton';
import { getAvatarSource } from '../../core/theme/avatar';

interface Props {
  onNavigateTab: (tab: 'home' | 'companion' | 'medication' | 'checkin' | 'profile') => void;
}

export const ElderlyHomeScreen: React.FC<Props> = ({ onNavigateTab }) => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { user } = useSession();
  const { fs,fontScale } = useAccessibilityStore();
  const doses = useDoseList();
  const checkin = useTodayCheckin();
  const todayMeds = doses.data?.items ?? [];
  const todayCheckIn = checkin.data;
  const loading = doses.isPending;
  const refreshing = doses.isRefetching || checkin.isRefetching;
  const onRefresh = () => { void doses.refetch(); void checkin.refetch(); };
  const pendingMeds = todayMeds.filter((m) => m.status === 'PENDING');
  const nextPendingMed = pendingMeds[0];
  const takenCount = todayMeds.filter((m) => m.status === 'TAKEN').length;
  const totalMeds = todayMeds.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Eldora-Style Greeting Top Bar */}
      <View style={styles.topGreetingBar}>
        <View style={styles.greetingTextCol}>
          <Text style={[styles.greetingSub, { fontSize: fs(14) }]}>{tr("Chào buổi sáng,")}</Text>
          <Text style={[styles.greetingName, { fontSize: fs(24) }]}>
            {user?.fullName || tr("Người cao tuổi")}
          </Text>
          {fontScale <= 1.2 && <Text style={[styles.greetingQuestion, { fontSize: fs(13) }]}>{tr("Hôm nay cụ cảm thấy thế nào ạ?")}</Text>}
        </View>

        {/* Senior Photo Avatar Box */}
        <TouchableOpacity
          style={styles.seniorAvatarBox}
          onPress={() => onNavigateTab('profile')}
          activeOpacity={0.8}
          accessibilityLabel={tr("Xem hồ sơ")}
        >
          <Image
            source={getAvatarSource(user?.avatarUrl)}
            style={styles.seniorAvatarImg}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* 2. Emergency SOS Access (Discrete, non-overlapping) */}
      <View style={styles.sosContainer}>
        <SOSButton />
      </View>

      {doses.isError && <View style={styles.sectionWrap}><Notice tone="danger" text={tr("Không thể tải lịch thuốc. Vui lòng thử lại.")} /><Button title={tr("Thử lại")} onPress={onRefresh} /></View>}
      {doses.data?.stale && <Notice tone="warning" text={tr("Đang xem lịch đã lưu. Chưa đồng bộ với máy chủ.")} />}
      {checkin.isError && <Notice tone="warning" text={tr("Chưa tải được điểm danh hôm nay.")} />}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: fs(14) }]}>{tr("Đang tải thông tin sức khỏe của cụ...")}</Text>
        </View>
      ) : (
        <>
          {/* 5. Upcoming (Sắp tới - Cữ thuốc hoặc sự kiện) */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { fontSize: fs(20) }]}>{tr("Sắp tới")}</Text>
              <TouchableOpacity onPress={() => onNavigateTab('medication')} activeOpacity={0.7}>
                <Text style={[styles.sectionActionText, { fontSize: fs(13) }]}>{tr("Xem tất cả ›")}</Text>
              </TouchableOpacity>
            </View>

            {doses.isError ? null : nextPendingMed ? (
              <View style={styles.upcomingCard}>
                <View style={styles.upcomingIconCircle}>
                  <Feather name="clock" size={22} color={colors.primary} />
                </View>

                <View style={styles.upcomingTextCol}>
                  <Text style={[styles.upcomingTime, { fontSize: fs(13) }]}>{tr("Cữ thuốc hôm nay • ")}{nextPendingMed.scheduledTime ? doseTime(nextPendingMed.scheduledAt, nextPendingMed.timeZone) : tr("Đúng giờ")}
                  </Text>
                  <Text style={[styles.upcomingMedName, { fontSize: fs(20) }]}>
                    {nextPendingMed.medicationName}
                  </Text>
                  <Text style={[styles.upcomingMedDose, { fontSize: fs(12.5) }]}>{tr("Liều dùng: ")}{nextPendingMed.dosage}
                    {nextPendingMed.instructions ? ` • ${nextPendingMed.instructions}` : ''}
                  </Text>

                    <DoseActions dose={nextPendingMed} />
                </View>
              </View>
            ) : totalMeds > 0 && takenCount === totalMeds ? (
              <View style={styles.allDoneUpcomingCard}>
                <View style={styles.allDoneIconCircle}>
                  <Feather name="check-circle" size={24} color={colors.successText} />
                </View>
                <View style={styles.allDoneTextCol}>
                  <Text style={[styles.allDoneTitle, { fontSize: fs(15) }]}>{tr("Đã hoàn thành toàn bộ cữ thuốc hôm nay")}</Text>
                  <Text style={[styles.allDoneSub, { fontSize: fs(12) }]}>{tr("Cụ đã uống đủ ")}{takenCount}{tr("/")}{totalMeds}{tr(" cữ thuốc đúng giờ. Rất tuyệt vời ạ!")}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyUpcomingCard}>
                <View style={styles.allDoneIconCircle}>
                  <Feather name="calendar" size={24} color={colors.primary} />
                </View>
                <View style={styles.allDoneTextCol}>
                  <Text style={[styles.allDoneTitle, { fontSize: fs(15) }]}>{tr("Không có lịch nhắc cần xử lý")}</Text>
                  <Text style={[styles.allDoneSub, { fontSize: fs(12) }]}>{tr("Chúc cụ một ngày thật bình an và vui vẻ bên con cháu!")}</Text>
                </View>
              </View>
            )}
          </View>


          {/* 3. Daily Wellness Card (Eldora-Style Peach/Cream Hero) */}
          <View style={styles.sectionWrap}>
            <View style={styles.dailyWellnessCard}>
              <View style={styles.wellnessLeftCol}>
                <View style={styles.wellnessBadge}>
                  <Text style={[styles.wellnessBadgeText, { fontSize: fs(11) }]}>{tr("SỨC KHỎE HÔM NAY")}</Text>
                </View>
                <Text style={[styles.wellnessTitle, { fontSize: fs(20) }]}>
                  {todayCheckIn ? tr("Đã hoàn thành điểm danh") : tr("Điểm danh sức khỏe")}
                </Text>
                <Text style={[styles.wellnessDesc, { fontSize: fs(12.5) }]}>
                  {todayCheckIn
                    ? checkinSummaryLabel(todayCheckIn.mood,todayCheckIn.physicalHealth)
                    : tr("Chăm sóc sức khỏe cụ hôm nay cùng gia đình")}
                </Text>

                <TouchableOpacity
                  style={[styles.wellnessBtn, todayCheckIn && styles.wellnessBtnDone]}
                  onPress={() => onNavigateTab('checkin')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.wellnessBtnText, { fontSize: fs(13) }]}>
                    {todayCheckIn ? tr("Xem lại kết quả") : tr("Điểm danh ngay")}
                  </Text>
                  <Feather
                    name={todayCheckIn ? 'check' : 'arrow-right'}
                    size={14}
                    color={colors.textInverse}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.wellnessRightCol}>
                <View style={styles.smileFaceCircle}>
                  <Feather
                    name={todayCheckIn ? 'check-circle' : 'smile'}
                    size={28}
                    color={todayCheckIn ? colors.successText : colors.primary}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 4. Quick Actions Grid: "Cụ muốn làm gì hôm nay?" (Eldora 3x2 Grid with Vector Icons) */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.gridSectionTitle, { fontSize: fs(20) }]}>{tr("Cụ muốn làm gì hôm nay?")}</Text>

            <View style={styles.actionsGrid}>
              {/* Item 1: Sức khỏe */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('checkin')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#FBEBEB' : colors.surfaceWarm }]}>
                  <Feather name="activity" size={20} color={colors.background === baseColors.background ? "#B83232" : colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Sức khỏe")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>{tr("Điểm danh")}</Text>
              </TouchableOpacity>

              {/* Item 2: Thuốc uống */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('medication')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#EAF3F9' : colors.surfaceWarm }]}>
                  <MaterialCommunityIcons name="pill" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Thuốc uống")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>
                  {totalMeds > 0 ? `${takenCount}/${totalMeds} cữ` : tr("Nhắc cữ")}
                </Text>
              </TouchableOpacity>

              {/* Item 3: Trò chuyện AI */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('companion')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#EDF5EF' : colors.surfaceWarm }]}>
                  <Feather name="message-circle" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Trợ lý AI")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>{tr("Tâm sự cùng cụ")}</Text>
              </TouchableOpacity>

              {/* Item 4: Gia đình */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('profile')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#FDF4E7' : colors.surfaceWarm }]}>
                  <Feather name="users" size={20} color={colors.background === baseColors.background ? "#995C17" : colors.primary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Gia đình")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>{tr("Con cháu")}</Text>
              </TouchableOpacity>

              {/* Item 5: Trợ giúp khẩn cấp */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => {
                  Alert.alert(
                    tr("Trợ giúp khẩn cấp SOS"),
                    tr("Cụ có thể nhấn nút \"Cần trợ giúp khẩn cấp?\" ở đầu trang để gửi thông báo ngay cho con gái Nguyễn Thị Hoa.")
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#FBEBEB' : colors.surfaceWarm }]}>
                  <Feather name="alert-triangle" size={20} color={colors.dangerText} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Khẩn cấp")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>{tr("Hỗ trợ SOS")}</Text>
              </TouchableOpacity>

              {/* Item 6: Cài đặt / Cỡ chữ */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => onNavigateTab('profile')}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.background === baseColors.background ? '#F3EFE6' : colors.surfaceWarm }]}>
                  <Feather name="type" size={20} color={colors.textPrimary} />
                </View>
                <Text style={[styles.gridCardTitle, { fontSize: fs(13.5) }]}>{tr("Cỡ chữ")}</Text>
                <Text style={[styles.gridCardSub, { fontSize: fs(11) }]}>{tr("Điều chỉnh")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 6. Today's Tip Card (Eldora Soft Green Nature Card) */}
          <View style={styles.sectionWrap}>
            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Feather name="sun" size={20} color={colors.background === baseColors.background ? "#8F6624" : colors.primary} />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={[styles.tipKicker, { fontSize: fs(11) }]}>{tr("LỜI KHUYÊN SỨC KHỎE TỪ MIMAMORI AI")}</Text>
                <Text style={[styles.tipBody, { fontSize: fs(13.5) }]}>{tr("Một ly nước ấm vào buổi sáng sau khi thức dậy sẽ giúp cơ thể cụ thanh lọc tự nhiên, tăng tuần hoàn máu và tinh thần sảng khoái suốt ngày dài!")}</Text>
              </View>
            </View>
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  topGreetingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greetingTextCol: {
    flex: 1,
  },
  greetingSub: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  greetingName: {
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  greetingQuestion: {
    color: colors.textSecondary,
  },
  seniorAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.subtle,
  },
  seniorAvatarImg: {
    width: '100%',
    height: '100%',
  },
  sosContainer: {
    marginBottom: 16,
  },
  centerLoading: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
  sectionWrap: {
    marginBottom: 18,
  },
  dailyWellnessCard: {
    flexDirection: 'row',
    backgroundColor: colors.background === baseColors.background ? '#F7EFE2' : colors.surfaceWarm,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.background === baseColors.background ? '#EBDDC5' : colors.border,
    ...shadows.subtle,
  },
  wellnessLeftCol: {
    flex: 1,
    paddingRight: 8,
  },
  wellnessBadge: {
    backgroundColor: colors.background===baseColors.background ? 'rgba(255,255,255,0.7)' : colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  wellnessBadgeText: {
    fontWeight: '800',
    color: colors.background === baseColors.background ? '#8F6624' : colors.textPrimary,
    letterSpacing: 0.5,
  },
  wellnessTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  wellnessDesc: {
    color: colors.textSecondary,

    marginBottom: 12,
  },
  wellnessBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  wellnessBtnDone: {
    backgroundColor: colors.successText,
  },
  wellnessBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  wellnessRightCol: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  smileFaceCircle: {
    width: 54,
    minHeight: 56,
    borderRadius: 27,
    backgroundColor: colors.background===baseColors.background ? 'rgba(255,255,255,0.85)' : colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridSectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  gridIconCircle: {
    width: 44,
    minHeight: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridCardTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  gridCardSub: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionActionText: {
    color: colors.primary,
    fontWeight: '700',
  },
  upcomingCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle,
  },
  upcomingIconCircle: {
    width: 44,
    height: 44,
    alignSelf: 'flex-start',
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upcomingTextCol: {
    flex: 1,
  },
  upcomingTime: {
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  upcomingMedName: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  upcomingMedDose: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  upcomingConfirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingConfirmBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  allDoneUpcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  allDoneIconCircle: {
    width: 40,
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: colors.background===baseColors.background ? 'rgba(255,255,255,0.7)' : colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  allDoneTextCol: {
    flex: 1,
  },
  allDoneTitle: {
    fontWeight: '800',
    color: colors.successText,
    marginBottom: 2,
  },
  allDoneSub: {
    color: colors.successText,

  },
  emptyUpcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.background === baseColors.background ? '#EEF4EF' : colors.surfaceWarm,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.background === baseColors.background ? '#D7E5D9' : colors.border,
  },
  tipIconCircle: {
    width: 40,
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: colors.background === baseColors.background ? '#FDF7EB' : colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipTextCol: {
    flex: 1,
  },
  tipKicker: {
    fontWeight: '800',
    color: colors.background === baseColors.background ? '#8F6624' : colors.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tipBody: {
    color: colors.textPrimary,

  },
});
