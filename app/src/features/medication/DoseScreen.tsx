import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../core/auth/useAuthStore";
import { careApi } from "../../core/api/careApi";
import { ApiError } from "../../core/api/client";
import { cachedDoses } from "../../core/storage/medicationStore";
import { Protected } from "../../core/auth/RoleGuard";
import {
  Screen,
  Heading,
  Loading,
  Notice,
  Button,
} from "../../components/CareUI";
import { DoseCard } from "./DoseCard";
function DoseContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const owner = useAuthStore((state) => state.userId);
  const query = useQuery({
    queryKey: ["dose", owner, id],
    enabled: owner !== null && Number.isSafeInteger(id) && id > 0,
    queryFn: async () => {
      try {
        return { dose: await careApi.dose(id), stale: false };
      } catch (error) {
        if (error instanceof ApiError && error.status === 0 && owner !== null) {
          const snapshot =
            (await cachedDoses(owner, `today:${owner}`)) ||
            (await cachedDoses(owner, "upcoming"));
          const dose = snapshot?.items.find((item) => item.id === id);
          if (dose) return { dose, stale: true };
        }
        throw error;
      }
    },
  });
  return (
    <Screen>
      <Heading>{t("medication")}</Heading>
      {!Number.isSafeInteger(id) || id <= 0 ? (
        <Notice tone="danger" text={t("doseNotFound")} />
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <>
          <Notice tone="danger" text={t("doseNotFound")} />
          <Button
            title={t("retry")}
            onPress={() => {
              void query.refetch();
            }}
          />
        </>
      ) : (
        <>
          {query.data.stale && <Notice text={t("stale")} />}
          <DoseCard dose={query.data.dose} />
        </>
      )}
      <Button
        title={t("back")}
        variant="secondary"
        onPress={() => router.replace("/medication")}
      />
    </Screen>
  );
}
export function DoseScreen() {
  return (
    <Protected>
      <DoseContent />
    </Protected>
  );
}
