import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { apiClient } from '../../core/api/client';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';

interface CheckInOption {
  id: string;
  label: string;
  desc: string;
  iconType: 'feather' | 'ionicons';
  iconName: any;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  cardActiveBorder: string;
  cardActiveBg: string;
}

interface Question {
  step: number;
  title: string;
  subtitle: string;
  category: string;
  options: CheckInOption[];
}

const QUESTIONS: Question[] = [
  {
    step: 1,
    title: 'Hôm nay tâm trạng của cụ thế nào ạ?',
    subtitle: 'Hãy chọn cảm xúc gần với cụ nhất vào lúc này',
    category: 'TÂM TRẠNG',
    options: [
      {
        id: 'Vui vẻ',
        label: 'Vui vẻ, phấn khởi',
        desc: 'Tinh thần thoải mái, vui tươi tràn đầy',
        iconType: 'feather',
        iconName: 'smile',
        iconBg: '#FFE4E6',
        iconColor: '#E11D48',
        iconBorder: '#FDA4AF',
        cardActiveBorder: '#E11D48',
        cardActiveBg: '#FFF1F2',
      },
      {
        id: 'Bình thường',
        label: 'Bình thường, an yên',
        desc: 'Một ngày yên bình, tâm an ổn định',
        iconType: 'feather',
        iconName: 'sun',
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        iconBorder: '#FDE68A',
        cardActiveBorder: '#D97706',
        cardActiveBg: '#FFFBEB',
      },
      {
        id: 'Hơi mệt',
        label: 'Hơi mệt, uể oải',
        desc: 'Cần nghỉ ngơi, thả lỏng nhiều hơn',
        iconType: 'feather',
        iconName: 'coffee',
        iconBg: '#FFEDD5',
        iconColor: '#EA580C',
        iconBorder: '#FED7AA',
        cardActiveBorder: '#EA580C',
        cardActiveBg: '#FFF7ED',
      },
      {
        id: 'Buồn bã',
        label: 'Buồn bã, lo lắng',
        desc: 'Có chuyện bận lòng muốn tâm sự cùng con cháu',
        iconType: 'ionicons',
        iconName: 'cloud-outline',
        iconBg: '#EDE9FE',
        iconColor: '#7C3AED',
        iconBorder: '#DDD6FE',
        cardActiveBorder: '#7C3AED',
        cardActiveBg: '#F5F3FF',
      },
    ],
  },
  {
    step: 2,
    title: 'Thể trạng trong người cụ ra sao?',
    subtitle: 'Đánh giá mức độ khỏe khoắn của cơ thể hôm nay',
    category: 'THỂ TRẠNG',
    options: [
      {
        id: 'Rất khỏe',
        label: 'Rất khỏe mạnh',
        desc: 'Đi lại, vận động nhẹ nhàng tốt',
        iconType: 'ionicons',
        iconName: 'fitness-outline',
        iconBg: '#DCFCE7',
        iconColor: '#16A34A',
        iconBorder: '#86EFAC',
        cardActiveBorder: '#16A34A',
        cardActiveBg: '#F0FDF4',
      },
      {
        id: 'Bình thường',
        label: 'Bình thường, ổn định',
        desc: 'Không có vấn đề gì đáng ngại',
        iconType: 'feather',
        iconName: 'activity',
        iconBg: '#E0F2FE',
        iconColor: '#0284C7',
        iconBorder: '#BAE6FD',
        cardActiveBorder: '#0284C7',
        cardActiveBg: '#F0F9FF',
      },
      {
        id: 'Đau nhức',
        label: 'Đau nhức cơ khớp',
        desc: 'Mỏi lưng, đau khớp hoặc nhức đầu nhẹ',
        iconType: 'ionicons',
        iconName: 'bandage-outline',
        iconBg: '#FFEDD5',
        iconColor: '#EA580C',
        iconBorder: '#FED7AA',
        cardActiveBorder: '#EA580C',
        cardActiveBg: '#FFF7ED',
      },
      {
        id: 'Chóng mặt',
        label: 'Chóng mặt, choáng váng',
        desc: 'Cần ngồi nghỉ ngơi, theo dõi thêm',
        iconType: 'feather',
        iconName: 'alert-triangle',
        iconBg: '#FEE2E2',
        iconColor: '#DC2626',
        iconBorder: '#FECACA',
        cardActiveBorder: '#DC2626',
        cardActiveBg: '#FEF2F2',
      },
    ],
  },
  {
    step: 3,
    title: 'Đêm qua cụ ngủ có ngon giấc không?',
    subtitle: 'Chất lượng giấc ngủ rất quan trọng với sức khỏe',
    category: 'GIẤC NGỦ',
    options: [
      {
        id: 'Ngủ rất ngon',
        label: 'Ngủ sâu, ngon giấc',
        desc: 'Ngủ đủ giấc, sáng dậy khoan khoái tỉnh táo',
        iconType: 'feather',
        iconName: 'moon',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        iconBorder: '#C7D2FE',
        cardActiveBorder: '#4F46E5',
        cardActiveBg: '#F5F7FF',
      },
      {
        id: 'Đủ giấc',
        label: 'Ngủ đủ giấc, ổn định',
        desc: 'Giấc ngủ êm đềm, không bị gián đoạn',
        iconType: 'feather',
        iconName: 'check-circle',
        iconBg: '#CCFBF1',
        iconColor: '#0D9488',
        iconBorder: '#99F6E4',
        cardActiveBorder: '#0D9488',
        cardActiveBg: '#F0FDFA',
      },
      {
        id: 'Chập chờn',
        label: 'Ngủ chập chờn',
        desc: 'Dễ thức giấc nửa đêm, khó ngủ lại',
        iconType: 'ionicons',
        iconName: 'bed-outline',
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        iconBorder: '#FDE68A',
        cardActiveBorder: '#D97706',
        cardActiveBg: '#FFFBEB',
      },
      {
        id: 'Mất ngủ',
        label: 'Khó ngủ, mất ngủ',
        desc: 'Trằn trọc nhiều tiếng đồng hồ trong đêm',
        iconType: 'feather',
        iconName: 'eye',
        iconBg: '#FCE7F3',
        iconColor: '#DB2777',
        iconBorder: '#FBCFE8',
        cardActiveBorder: '#DB2777',
        cardActiveBg: '#FDF2F8',
      },
    ],
  },
  {
    step: 4,
    title: 'Hôm nay cụ ăn uống thế nào?',
    subtitle: 'Tình hình ăn uống và lời nhắn gửi gia đình',
    category: 'ĂN UỐNG',
    options: [
      {
        id: 'Ngon miệng',
        label: 'Ăn uống rất ngon miệng',
        desc: 'Ăn hết khẩu phần cơm, tiêu hóa êm',
        iconType: 'ionicons',
        iconName: 'restaurant-outline',
        iconBg: '#DCFCE7',
        iconColor: '#16A34A',
        iconBorder: '#86EFAC',
        cardActiveBorder: '#16A34A',
        cardActiveBg: '#F0FDF4',
      },
      {
        id: 'Bình thường',
        label: 'Ăn vừa phải, no đủ',
        desc: 'Ăn uống lượng vừa đủ với cơ thể',
        iconType: 'feather',
        iconName: 'coffee',
        iconBg: '#FEF9C3',
        iconColor: '#CA8A04',
        iconBorder: '#FDE047',
        cardActiveBorder: '#CA8A04',
        cardActiveBg: '#FEFCE8',
      },
      {
        id: 'Ăn ít',
        label: 'Ăn ít hơn ngày thường',
        desc: 'Ăn nửa bát, cảm thấy nhanh no',
        iconType: 'ionicons',
        iconName: 'nutrition-outline',
        iconBg: '#FFEDD5',
        iconColor: '#EA580C',
        iconBorder: '#FED7AA',
        cardActiveBorder: '#EA580C',
        cardActiveBg: '#FFF7ED',
      },
      {
        id: 'Chán ăn',
        label: 'Chán ăn, mệt mỏi',
        desc: 'Không thấy đói, chỉ ăn qua loa vài thìa',
        iconType: 'feather',
        iconName: 'alert-circle',
        iconBg: '#FEE2E2',
        iconColor: '#DC2626',
        iconBorder: '#FECACA',
        cardActiveBorder: '#DC2626',
        cardActiveBg: '#FEF2F2',
      },
    ],
  },
];

interface Props {
  onSuccess?: () => void;
}

export const ElderlyCheckInScreen: React.FC<Props> = ({ onSuccess }) => {
  const { fs } = useAccessibilityStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [mood, setMood] = useState('Bình thường');
  const [physicalHealth, setPhysicalHealth] = useState('Bình thường');
  const [sleepQuality, setSleepQuality] = useState('Ngủ rất ngon');
  const [appetite, setAppetite] = useState('Bình thường');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedResult, setCompletedResult] = useState<any>(null);

  const totalSteps = 4;
  const currentQuestion = QUESTIONS[currentStep - 1];

  const getSelectedValue = () => {
    switch (currentStep) {
      case 1:
        return mood;
      case 2:
        return physicalHealth;
      case 3:
        return sleepQuality;
      case 4:
        return appetite;
      default:
        return '';
    }
  };

  const handleSelectOption = (value: string) => {
    switch (currentStep) {
      case 1:
        setMood(value);
        break;
      case 2:
        setPhysicalHealth(value);
        break;
      case 3:
        setSleepQuality(value);
        break;
      case 4:
        setAppetite(value);
        break;
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await apiClient('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({
          mood,
          physicalHealth,
          sleepQuality,
          appetite,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.success && res.data) {
        setCompletedResult(res.data);
      }
    } catch (err: any) {
      Alert.alert('Lỗi gửi điểm danh', err.message || 'Không thể gửi điểm danh lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completedResult) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.completedContainer}>
        {/* Screen 7: Header bar */}
        <View style={styles.completedHeaderBar}>
          <TouchableOpacity
            style={styles.backBtnCircle}
            onPress={() => {
              if (onSuccess) onSuccess();
            }}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTagPill}>
            <Text style={styles.headerTagText}>Hoàn thành điểm danh</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Celebratory Check Circle with Confetti Petals */}
        <View style={styles.confettiArea}>
          {/* Confetti Petals */}
          <View style={[styles.petal, styles.petalTopLeft]} />
          <View style={[styles.petal, styles.petalTopRight]} />
          <View style={[styles.petal, styles.petalMidLeft]} />
          <View style={[styles.petal, styles.petalMidRight]} />
          <View style={[styles.petal, styles.petalBottomLeft]} />
          <View style={[styles.petal, styles.petalBottomRight]} />

          {/* Big Green Circle with Checkmark */}
          <View style={styles.celebrationCircle}>
            <Feather name="check" size={56} color="#FFFFFF" />
          </View>
        </View>

        {/* Headline & Subtitle */}
        <Text style={[styles.completedHeadline, { fontSize: fs(24) }]}>
          Đã ghi nhận{'\n'}thông tin sức khỏe!
        </Text>
        <Text style={[styles.completedSubhead, { fontSize: fs(14.5) }]}>
          Cảm ơn ông/bà đã chia sẻ.{'\n'}Gia đình sẽ nhận được cập nhật.
        </Text>

        {/* Summary Card (Soft Green) */}
        <View style={styles.screen7SummaryCard}>
          <Text style={[styles.screen7SummaryTitle, { fontSize: fs(16) }]}>
            Tóm tắt hôm nay:
          </Text>
          <Text style={[styles.screen7SummaryItem, { fontSize: fs(14.5) }]}>
            • Tâm trạng: <Text style={styles.screen7SummaryVal}>{completedResult.mood || mood}</Text>
          </Text>
          <Text style={[styles.screen7SummaryItem, { fontSize: fs(14.5) }]}>
            • Thể trạng: <Text style={styles.screen7SummaryVal}>{completedResult.physicalHealth || physicalHealth}</Text>
          </Text>
          {completedResult.sleepQuality ? (
            <Text style={[styles.screen7SummaryItem, { fontSize: fs(14.5) }]}>
              • Giấc ngủ: <Text style={styles.screen7SummaryVal}>{completedResult.sleepQuality}</Text>
            </Text>
          ) : null}
          {completedResult.appetite ? (
            <Text style={[styles.screen7SummaryItem, { fontSize: fs(14.5) }]}>
              • Ăn uống: <Text style={styles.screen7SummaryVal}>{completedResult.appetite}</Text>
            </Text>
          ) : null}
        </View>

        {completedResult.aiAnalysis ? (
          <View style={styles.aiFeedbackBox}>
            <View style={styles.aiFeedbackHeader}>
              <Feather name="smile" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.aiFeedbackTitle, { fontSize: fs(13) }]}>
                Lời nhắn từ Trợ lý AI
              </Text>
            </View>
            <Text style={[styles.aiFeedbackText, { fontSize: fs(13.5) }]}>
              {completedResult.aiAnalysis}
            </Text>
          </View>
        ) : null}

        {/* Primary Action Button: Về trang chủ */}
        <TouchableOpacity
          style={styles.screen7DoneBtn}
          onPress={() => {
            if (onSuccess) onSuccess();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.screen7DoneBtnText, { fontSize: fs(15.5) }]}>
            Về trang chủ
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const selectedValue = getSelectedValue();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Step Indicator Header */}
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}>
          <Text style={[styles.stepBadgeText, { fontSize: fs(12) }]}>
            {currentQuestion.category} • BƯỚC {currentStep}/{totalSteps}
          </Text>
        </View>
        <Text style={[styles.questionTitle, { fontSize: fs(21) }]}>
          {currentQuestion.title}
        </Text>
        <Text style={[styles.questionSubtitle, { fontSize: fs(13.5) }]}>
          {currentQuestion.subtitle}
        </Text>

        {/* Step Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / totalSteps) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Options List with Dynamic Custom-Colored Icons & Matching Borders */}
      <View style={styles.optionsList}>
        {currentQuestion.options.map((opt) => {
          const isSelected = selectedValue === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionCard,
                isSelected && {
                  borderColor: opt.cardActiveBorder,
                  backgroundColor: opt.cardActiveBg,
                },
              ]}
              onPress={() => handleSelectOption(opt.id)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              {/* Dynamic Icon Circle with Custom Background and Matching Border */}
              <View
                style={[
                  styles.optionIconCircle,
                  {
                    backgroundColor: opt.iconBg,
                    borderColor: opt.iconBorder,
                    borderWidth: 1.5,
                  },
                ]}
              >
                {opt.iconType === 'feather' ? (
                  <Feather
                    name={opt.iconName}
                    size={22}
                    color={opt.iconColor}
                  />
                ) : (
                  <Ionicons
                    name={opt.iconName}
                    size={22}
                    color={opt.iconColor}
                  />
                )}
              </View>

              <View style={styles.optionTextCol}>
                <Text
                  style={[
                    styles.optionLabel,
                    { fontSize: fs(16) },
                    isSelected && { color: opt.iconColor, fontWeight: '800' },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={[styles.optionDesc, { fontSize: fs(12.5) }]}>
                  {opt.desc}
                </Text>
              </View>

              <View style={styles.radioWrapper}>
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSelected ? opt.iconColor : colors.border}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Step 4 Extra Note Box */}
      {currentStep === 4 && (
        <View style={styles.noteSection}>
          <Text style={[styles.noteLabel, { fontSize: fs(13.5) }]}>
            Ghi chú thêm cho con cháu hoặc bác sĩ (nếu có):
          </Text>
          <TextInput
            style={[styles.noteInput, { fontSize: fs(14) }]}
            placeholder="Ví dụ: Cụ thấy đau lưng nhẹ, sáng nay ăn cháo hạt sen..."
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Navigation Buttons */}
      <View style={styles.btnRow}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.backBtnText, { fontSize: fs(14) }]}>Quay lại</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextBtn, currentStep === 1 && { flex: 1 }]}
          onPress={handleNext}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.nextBtnText, { fontSize: fs(15) }]}>
                {currentStep === totalSteps ? 'Gửi điểm danh' : 'Tiếp theo'}
              </Text>
              <Feather
                name={currentStep === totalSteps ? 'check' : 'arrow-right'}
                size={16}
                color="#FFFFFF"
                style={{ marginLeft: 6 }}
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  stepHeader: {
    marginBottom: 20,
  },
  stepBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  stepBadgeText: {
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  questionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 4,
  },
  questionSubtitle: {
    color: colors.textSecondary,
    marginBottom: 14,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  optionsList: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    minHeight: 68,
    ...shadows.subtle,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconCircleSelected: {
    backgroundColor: colors.surface,
  },
  optionTextCol: {
    flex: 1,
  },
  optionLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  optionDesc: {
    color: colors.textSecondary,
  },
  radioWrapper: {
    paddingLeft: 8,
  },
  noteSection: {
    marginBottom: 20,
  },
  noteLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 80,
    color: colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  completedContainer: {
    padding: 20,
    paddingTop: 10,
    minHeight: '100%',
    backgroundColor: colors.background,
  },
  completedHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  headerTagPill: {
    backgroundColor: '#3E5C4B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerTagText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  confettiArea: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  celebrationCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#75B884',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  petal: {
    position: 'absolute',
    borderRadius: 8,
  },
  petalTopLeft: {
    top: 20,
    left: '26%',
    width: 10,
    height: 16,
    backgroundColor: '#F6D06F',
    transform: [{ rotate: '-35deg' }],
  },
  petalTopRight: {
    top: 30,
    right: '25%',
    width: 14,
    height: 14,
    backgroundColor: '#F9B277',
    transform: [{ rotate: '40deg' }],
  },
  petalMidLeft: {
    top: 75,
    left: '18%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#85C292',
  },
  petalMidRight: {
    top: 85,
    right: '18%',
    width: 12,
    height: 18,
    backgroundColor: '#75B884',
    transform: [{ rotate: '-50deg' }],
  },
  petalBottomLeft: {
    bottom: 25,
    left: '24%',
    width: 12,
    height: 14,
    backgroundColor: '#F6D06F',
    transform: [{ rotate: '20deg' }],
  },
  petalBottomRight: {
    bottom: 25,
    right: '24%',
    width: 10,
    height: 16,
    backgroundColor: '#85C292',
    transform: [{ rotate: '-25deg' }],
  },
  completedHeadline: {
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 10,
  },
  completedSubhead: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  screen7SummaryCard: {
    backgroundColor: '#EDF5EF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D4E6D9',
  },
  screen7SummaryTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  screen7SummaryItem: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  screen7SummaryVal: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  screen7DoneBtn: {
    backgroundColor: '#456B58',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  screen7DoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  summaryList: {
    width: '100%',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryValue: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiFeedbackBox: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  aiFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiFeedbackTitle: {
    fontWeight: '800',
    color: colors.primary,
  },
  aiFeedbackText: {
    color: colors.textPrimary,
    lineHeight: 20,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});