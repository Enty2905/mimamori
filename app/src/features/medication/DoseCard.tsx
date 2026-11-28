import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Dose } from "../../core/api/contracts";
import { doseTime } from "../../core/config/time";
import { Body, Button, Notice, layout } from "../../components/CareUI";
import { colors } from "../../core/theme/colors";
import {
  useConfirmDose,
  useQueuedConfirmations,
  discardConflict,
} from "./queries";
export function DoseCard({ dose }: { dose: Dose }) {
  const { t, i18n } = useTranslation();
  const confirm = useConfirmDose();
  const queued = useQueuedConfirmations();
  const pending = queued.data?.find(
    (item) => item.occurrence_id === dose.occurrenceId,
  );
  const final = dose.status === "TAKEN" || dose.status === "SKIPPED";
  const late =
    dose.status === "PENDING" &&
    new Date(dose.scheduledAt).getTime() < Date.now();
  return (
    <View style={styles.card}>
      <Body style={styles.time}>
        {t("doseTime", {
          time: doseTime(dose.scheduledAt, dose.timeZone, i18n.language),
        })}
      </Body>
      <Body size={24} style={{ fontWeight: "700" }}>
        {dose.medicationName}
      </Body>
      <Body>
        {t("dosage")}: {dose.dosage}
      </Body>
      {!!dose.instructions && (
        <Body size={18} style={layout.muted}>
          {dose.instructions}
        </Body>
      )}
      <Body size={18}>{t(late ? "MISSED" : dose.status)}</Body>
      {pending ? (
        <Notice
          tone={pending.error_code ? "danger" : "warning"}
          text={t(pending.error_code ? "syncConflict" : "pendingSync")}
        />
      ) : (
        !final && (
          <Button
            title={t("confirmTaken")}
            busy={confirm.isPending}
            onPress={() => confirm.mutate(dose)}
          />
        )
      )}
      {pending?.error_code && (
        <Button
          title={t("discardConflict")}
          variant="secondary"
          onPress={() => {
            void discardConflict(dose.occurrenceId);
          }}
        />
      )}
      {confirm.isSuccess && !confirm.data && !pending && (
        <Notice tone="success" text={t("confirmed")} />
      )}
      {confirm.isError && <Notice tone="danger" text={t("error")} />}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingVertical: 20,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  time: { color: colors.primary, fontWeight: "600" },
});
