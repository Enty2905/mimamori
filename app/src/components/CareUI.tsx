import {useColors} from "../core/theme/useTheme";
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors as baseColors } from "../core/theme/colors";
import { useAccessibilityStore } from "../core/accessibility/useAccessibilityStore";
import { changeLanguage } from "../core/localization/i18n";
import {useMutation} from '@tanstack/react-query';
import {careApi} from '../core/api/careApi';
import {useAuthStore} from '../core/auth/useAuthStore';
import {queryClient} from '../core/api/queryClient';

export function Body({
  size = 20,
  style,
  ...props
}: React.ComponentProps<typeof Text> & { size?: number }) {
  const colors=useColors();
  const s=buildStyles(colors);
  const {fs} = useAccessibilityStore();
  const fontSize = fs(size);
  return (
    <Text
      {...props}
      style={[
        s.body,
        { fontSize, lineHeight: Math.ceil(fontSize * 1.45) },
        style,
      ]}
    />
  );
}
export function Heading({ children }: React.PropsWithChildren) {
  const colors=useColors();
  const s=buildStyles(colors);
  return (
    <Body size={26} accessibilityRole="header" style={s.heading}>
      {children}
    </Body>
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  disabled = false,
  variant = "primary",
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testID?: string;
}) {
  const colors=useColors();
  const s=buildStyles(colors);
  const [focused, setFocused] = useState(false);
  const inactive = disabled || busy;
  const primary = variant === "primary";
  const danger = variant === "danger";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: inactive
            ? colors.surfaceMuted
            : primary
              ? pressed
                ? colors.primaryDark
                : colors.primary
              : danger
                ? colors.danger
                : pressed
                  ? colors.primaryLight
                  : colors.surface,
          borderColor: focused
            ? colors.primaryDark
            : danger
              ? colors.dangerText
              : colors.primary,
          borderWidth: focused ? 3 : 1.5,
        },
      ]}
    >
      {busy && (
        <ActivityIndicator
          color={primary ? colors.textInverse : colors.primary}
        />
      )}
      <Body
        style={[
          s.buttonText,
          {
            color: inactive
              ? colors.textSecondary
              : primary
                ? colors.textInverse
                : danger
                  ? colors.dangerText
                  : colors.primary,
          },
        ]}
      >
        {title}
      </Body>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  error?: boolean;
}) {
  const colors=useColors();
  const s=buildStyles(colors);
  const {fs} = useAccessibilityStore();
  return (
    <View style={s.field}>
      <Body size={18} style={s.label}>
        {label}
      </Body>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          s.input,
          {
            fontSize: fs(20),
            lineHeight: Math.ceil(fs(20) * 1.4),
            borderColor: error ? colors.dangerText : colors.textMuted,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Section({ children }: React.PropsWithChildren) {
  const colors=useColors();
  const s=buildStyles(colors);
  return <View style={s.section}>{children}</View>;
}
export function Notice({
  text,
  tone = "warning",
}: {
  text: string;
  tone?: "warning" | "danger" | "success";
}) {
  const colors=useColors();
  const s=buildStyles(colors);
  return (
    <View style={[s.notice, { backgroundColor: colors[tone] }]}>
      <Body
        size={18}
        accessibilityRole={tone === "danger" ? "alert" : undefined}
        style={{ color: colors[`${tone}Text`] }}
      >
        {text}
      </Body>
    </View>
  );
}
export function Loading() {
  const colors=useColors();
  const s=buildStyles(colors);
  const { t } = useTranslation();
  return (
    <View style={s.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Body>{t("loading")}</Body>
    </View>
  );
}
export function Screen({
  children,
  scroll = true,
}: React.PropsWithChildren<{ scroll?: boolean }>) {
  const colors=useColors();
  const s=buildStyles(colors);
  const { width } = useWindowDimensions();
  const container = [s.content, { padding: width < 380 ? 16 : 24 }];
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          style={s.flex}
          contentContainerStyle={container}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[...container, s.flex]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}
export function LanguageControl() {
  const colors=useColors();
  const s=buildStyles(colors);
  const { t, i18n } = useTranslation();
  const owner=useAuthStore(state=>state.userId);
  const save=useMutation({mutationFn:async (language:'ja'|'vi')=>{
    await changeLanguage(language);
    if(owner!==null){const profile=await careApi.saveProfile({languagePreference:language});queryClient.setQueryData(['profile',owner],profile);}
  }});
  return (
    <View style={s.row}>
      <Body size={18}>{t("language")}</Body>
      <Button
        title={i18n.language === "ja" ? "Tiếng Việt" : "日本語"}
        variant="secondary"
        busy={save.isPending}
        onPress={() => {
          save.mutate(i18n.language === "ja" ? "vi" : "ja");
        }}
      />
      {save.isError && <Notice tone="warning" text={t('stale')} />}
    </View>
  );
}
export const layout = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  stack: { gap: 16 },
  line: { height: 1, backgroundColor: baseColors.border, marginVertical: 8 },
  grow: { flex: 1 },
  muted: {},
});
const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    gap: 20,
    paddingBottom: 32,
  },
  body: { color: colors.textPrimary, fontWeight: "400", flexShrink: 1 },
  heading: { fontWeight: "700" },
  button: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontWeight: "600", textAlign: "center" },
  field: { gap: 8 },
  label: { fontWeight: "600" },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  section: {
    gap: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notice: { padding: 16, borderRadius: 12 },
  loading: { padding: 24, gap: 16, alignItems: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
});
