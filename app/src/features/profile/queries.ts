import { useQuery } from "@tanstack/react-query";
import { careApi } from "../../core/api/careApi";
import { useAuthStore } from "../../core/auth/useAuthStore";
export function useProfile() {
  const id = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["profile", id],
    enabled: id !== null,
    queryFn: careApi.profile,
  });
}
