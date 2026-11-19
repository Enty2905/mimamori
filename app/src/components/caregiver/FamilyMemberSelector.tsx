import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { colors, shadows } from '../../core/theme/colors';
import { getAvatarSource } from '../../core/theme/avatar';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';
import { FamilyMemberDto, getCareStatusMeta } from '../../core/utils/caregiverHelpers';

export interface FamilyMemberSelectorProps {
  members: FamilyMemberDto[];
  selectedId: number | null;
  onSelect: (elderlyId: number) => void;
  statusByMemberId?: Record<number, string | undefined>;
  statusLabelByMemberId?: Record<number, string | undefined>;
}

export const FamilyMemberSelector: React.FC<FamilyMemberSelectorProps> = ({
  members,
  selectedId,
  onSelect,
  statusByMemberId,
  statusLabelByMemberId,
}) => {
  const { fs } = useAccessibilityStore();

  if (!members || members.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      {members.map((fm) => {
        const memberId = fm.member.id;
        const isSelected = selectedId === memberId;
        const rawStatus = statusByMemberId?.[memberId];
        const customLabel = statusLabelByMemberId?.[memberId];
        const statusMeta = rawStatus ? getCareStatusMeta(rawStatus) : null;
        const statusText = customLabel ?? statusMeta?.label;

        return (
          <TouchableOpacity
            key={fm.relationshipId ?? memberId}
            style={[styles.pill, isSelected ? styles.pillSelected : styles.pillUnselected]}
            onPress={() => onSelect(memberId)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={fm.member.fullName}
          >
            <Image
              source={getAvatarSource(fm.member.avatarUrl)}
              style={[
                styles.avatar,
                isSelected ? styles.avatarSelected : styles.avatarUnselected,
              ]}
            />
            <View style={styles.textWrap}>
              <Text
                style={[
                  styles.name,
                  { fontSize: fs(14) },
                  isSelected && styles.nameSelected,
                ]}
                numberOfLines={1}
              >
                {fm.member.fullName}
              </Text>

              {Boolean(statusText) && (
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusMeta?.text ?? colors.primary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        fontSize: fs(11.5),
                        color: statusMeta?.text ?? colors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {statusText}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 10,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 10,
    maxWidth: 230,
    ...shadows.subtle,
  },
  pillSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pillUnselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
  },
  avatarSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatarUnselected: {
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  nameSelected: {
    color: colors.primaryDark,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontWeight: '600',
    flexShrink: 1,
  },
});
