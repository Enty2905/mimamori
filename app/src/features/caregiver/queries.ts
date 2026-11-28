import { useEffect } from "react";
import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { careApi } from "../../core/api/careApi";
import { useAuthStore } from "../../core/auth/useAuthStore";
const useFamilySelection = create<{
  owner: number | null;
  id: number | undefined;
  select: (owner: number, id: number | undefined) => void;
}>((set) => ({
  owner: null,
  id: undefined,
  select: (owner, id) => set({ owner, id }),
}));
export function useFamily() {
  const owner = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["family", owner],
    enabled: owner !== null,
    queryFn: careApi.family,
  });
}
export function useSelectedElderly() {
  const owner = useAuthStore((state) => state.userId);
  const family = useFamily();
  const selectedOwner = useFamilySelection((state) => state.owner);
  const selectedId = useFamilySelection((state) => state.id);
  const select = useFamilySelection((state) => state.select);
  const id = selectedOwner === owner ? selectedId : undefined;
  const preferred = family.data?.find((member) => member.status === "ACCEPTED")
    ?.member.id;
  const valid = family.data?.some(
    (member) => member.status === "ACCEPTED" && member.member.id === id,
  );
  useEffect(() => {
    if (!owner || !family.data) return;
    const next = valid ? id : preferred;
    if (selectedOwner !== owner || selectedId !== next) select(owner, next);
  }, [owner, family.data, id, valid, preferred, selectedOwner, selectedId, select]);
  return {
    family,
    id,
    select: (id: number) => {
      if (owner) select(owner, id);
    },
  };
}
