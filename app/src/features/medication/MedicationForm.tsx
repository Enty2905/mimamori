import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { careApi, Medication } from "../../core/api/careApi";
import { dateInZone, deviceTimeZone } from "../../core/config/time";
import { queryClient } from "../../core/api/queryClient";
import {
  Screen,
  Heading,
  Field,
  Button,
  Notice,
  Body,
} from "../../components/CareUI";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  dosage: z.string().trim().min(1).max(50),
  instructions: z.string().max(1000),
  times: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string(),
  timeZone: z.string().min(1),
});
type Values = z.infer<typeof schema>;
export function MedicationForm({
  elderlyId,
  medication,
  onClose,
}: {
  elderlyId?: number;
  medication?: Medication;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const zone = medication?.timeZone || deviceTimeZone();
  const form = useForm<Values>({
    defaultValues: {
      name: medication?.name || "",
      dosage: medication?.dosage || "",
      instructions: medication?.instructions || "",
      times:
        medication?.schedules
          .map((item) => item.reminderTime.slice(0, 5))
          .join(", ") || "08:00",
      startDate: medication?.startDate || dateInZone(new Date(), zone),
      endDate: medication?.endDate || "",
      timeZone: zone,
    },
  });
  const save = useMutation({
    mutationFn: async (values: Values) => {
      const valid = schema.safeParse(values);
      const times = values.times.split(",").map((item) => item.trim());
      if (
        !valid.success ||
        !elderlyId ||
        times.length > 8 ||
        !times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
        new Set(times).size !== times.length
      )
        throw new Error("Invalid form");
      await careApi.saveMedication(
        {
          ...valid.data,
          elderlyId,
          endDate: values.endDate || null,
          reminderTimes: times.map((time) => time + ":00"),
        },
        medication?.id,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["medications"] });
      void queryClient.invalidateQueries({ queryKey: ["doses"] });
      onClose();
    },
  });
  const fields: { name: keyof Values; label: string }[] = [
    { name: "name", label: t("medicationName") },
    { name: "dosage", label: t("dosage") },
    { name: "times", label: t("reminderTime") },
    { name: "startDate", label: t("startDate") },
    { name: "endDate", label: t("endDate") },
    { name: "instructions", label: t("instructions") },
  ];
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Screen>
        <Heading>{t(medication ? "editMedication" : "addMedication")}</Heading>
        <Body>{t("noMedicationHelp")}</Body>
        {fields.map((item) => (
          <Controller
            key={item.name}
            name={item.name}
            control={form.control}
            render={({ field: { value, onChange, onBlur } }) => (
              <Field
                label={item.label}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
              />
            )}
          />
        ))}
        <Body size={18}>{t("multipleTimes")}</Body>
        <Heading>{t("timeZone")}</Heading>
        <Controller
          control={form.control}
          name="timeZone"
          render={({ field: { value, onChange } }) => (
            <View style={{ gap: 12 }}>
              {[
                ["Asia/Tokyo", "zoneJapan"],
                ["Asia/Ho_Chi_Minh", "zoneVietnam"],
              ].map(([zone, label]) => (
                <Button
                  key={zone}
                  title={t(label)}
                  variant={value === zone ? "primary" : "secondary"}
                  onPress={() => onChange(zone)}
                />
              ))}
              {!["Asia/Tokyo", "Asia/Ho_Chi_Minh"].includes(value) && (
                <Body>{value}</Body>
              )}
            </View>
          )}
        />
        {save.isError && (
          <Notice
            tone="danger"
            text={t(
              save.error instanceof Error &&
                save.error.message === "Invalid form"
                ? "invalidForm"
                : "error",
            )}
          />
        )}
        <Button
          title={t("save")}
          busy={save.isPending}
          onPress={() => {
            void form.handleSubmit((values) => save.mutate(values))();
          }}
        />
        <Button
          title={t("cancel")}
          variant="secondary"
          disabled={save.isPending}
          onPress={onClose}
        />
      </Screen>
    </SafeAreaView>
  );
}
