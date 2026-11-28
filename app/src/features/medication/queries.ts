import { useMutation, useQuery } from "@tanstack/react-query";
import { careApi } from "../../core/api/careApi";
import { ApiError } from "../../core/api/client";
import { Dose } from "../../core/api/contracts";
import { useAuthStore } from "../../core/auth/useAuthStore";
import { queryClient } from "../../core/api/queryClient";
import {
  cachedDoses,
  cacheDoses,
  enqueueConfirmation,
  queuedConfirmations,
  removeConfirmation,
  markConfirmationConflict,
} from "../../core/storage/medicationStore";
import { drainConfirmations } from "./syncQueue";
const syncFlights = new Map<number, Promise<void>>();
export async function synchronizeConfirmations(owner: number) {
  const existing = syncFlights.get(owner);
  if (existing) return existing;
  const syncFlight = drainConfirmations(owner, {
    currentOwner: () => useAuthStore.getState().userId,
    list: queuedConfirmations,
    send: (item) =>
      careApi.confirm(item.dose_id, item.status, item.confirmed_at, owner),
    remove: removeConfirmation,
    conflict: markConfirmationConflict,
  }).finally(() => {
    syncFlights.delete(owner);
    void queryClient.invalidateQueries({ queryKey: ["doses"] });
    void queryClient.invalidateQueries({ queryKey: ["queued", owner] });
  });
  syncFlights.set(owner, syncFlight);
  return syncFlight;
}
export function useDoseList(
  kind: "today" | "history" = "today",
  targetId?: number,
) {
  const owner = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["doses", owner, targetId, kind],
    enabled: owner !== null,
    queryFn: async () => {
      const key = `${kind}:${targetId ?? owner}`;
      try {
        const items = await careApi[kind](targetId);
        if (owner !== null) await cacheDoses(owner, key, items);
        return { items, stale: false, updatedAt: new Date().toISOString() };
      } catch (error) {
        if (
          owner !== null &&
          error instanceof ApiError &&
          (error.status === 0 || error.status >= 500)
        ) {
          const local = await cachedDoses(owner, key);
          if (local) return { ...local, stale: true };
        }
        throw error;
      }
    },
  });
}
export function useQueuedConfirmations() {
  const owner = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["queued", owner],
    enabled: owner !== null,
    queryFn: () => queuedConfirmations(owner!),
    staleTime: 0,
  });
}
export function useConfirmDose() {
  const owner = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (dose: Dose) => {
      if (owner === null) throw new ApiError(401, "SESSION_EXPIRED");
      await enqueueConfirmation(owner, dose, "TAKEN");
      await queryClient.invalidateQueries({ queryKey: ["queued", owner] });
      await synchronizeConfirmations(owner);
      return (await queuedConfirmations(owner)).find(
        (item) => item.occurrence_id === dose.occurrenceId,
      );
    },
  });
}

export async function discardConflict(occurrenceId: string) {
  const owner = useAuthStore.getState().userId;
  if (owner === null) return;
  const item = (await queuedConfirmations(owner)).find(
    (value) => value.occurrence_id === occurrenceId,
  );
  if (!item?.error_code) return;
  await removeConfirmation(owner, occurrenceId);
  await queryClient.invalidateQueries({ queryKey: ["queued", owner] });
  await queryClient.invalidateQueries({ queryKey: ["doses"] });
}
