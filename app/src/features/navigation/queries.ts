import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { careApi } from '../../core/api/careApi';
export function useTodayCheckin() {
  const id = useAuthStore((state) => state.userId);
  return useQuery({queryKey: ['checkin', id], enabled: id !== null, queryFn: careApi.todayCheckin});
}
