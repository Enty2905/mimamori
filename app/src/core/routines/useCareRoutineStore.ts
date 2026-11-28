import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface MedicationLog {
  id: number;
  scheduleId?: number;
  medicationId?: number;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  takenTime?: string | null;
  actualTakenTime?: string | null;
  status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED';
  instruction?: string;
  notes?: string;
}

export interface CareRoutineLogDto {
  id: number;
  routineType: 'WATER' | 'SLEEP';
  scheduledTime: string;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  completedAt?: string | null;
  note?: string | null;
}

export interface DailyRoutineOverviewDto {
  elderlyId: number;
  waterTargetCups: number;
  waterCompletedCups: number;
  waterTargetMl?: number;
  waterCupMl?: number;
  waterCompletedMl?: number;
  hydrationPercent?: number;
  hydrationStatus?: 'NEEDS_MORE' | 'PROGRESSING' | 'MINIMUM_MET' | 'TARGET_ACHIEVED' | string;
  hydrationEvaluationText?: string;
  waterReminderTimes: string[];
  waterEnabled: boolean;
  bedtimeTime: string;
  wakeupTime: string;
  sleepTargetHours: number;
  sleepEnabled: boolean;
  sleepStatus: 'PENDING' | 'COMPLETED';
  sleepCompletedAt?: string | null;
  lastNightSleepQuality?: string | null;
  logs: CareRoutineLogDto[];
}

export function resolveWaterMetrics(routine?: DailyRoutineOverviewDto | null) {
  const cupMl = Math.max(50, routine?.waterCupMl ?? 200);
  const targetCups = Math.max(1, routine?.waterTargetCups ?? 7);
  const targetMl = Math.max(600, routine?.waterTargetMl ?? targetCups * cupMl);
  const completedCups = Math.max(0, routine?.waterCompletedCups ?? 0);
  const completedMl = routine?.waterCompletedMl ?? completedCups * cupMl;
  const percent =
    routine?.hydrationPercent ??
    Math.min(100, Math.round((completedMl / Math.max(1, targetMl)) * 100));
  const status =
    routine?.hydrationStatus ??
    (completedMl >= targetMl
      ? 'TARGET_ACHIEVED'
      : completedMl >= 1300
        ? 'MINIMUM_MET'
        : percent >= 50
          ? 'PROGRESSING'
          : 'NEEDS_MORE');
  const formatL = (ml: number) =>
    ml <= 0 ? '0' : ml % 100 === 0 ? (ml / 1000).toFixed(1) : (ml / 1000).toFixed(2);
  const evaluationText =
    routine?.hydrationEvaluationText ||
    (status === 'TARGET_ACHIEVED'
      ? `Đạt mục tiêu ngày (${formatL(completedMl)}/${formatL(targetMl)} L)`
      : status === 'MINIMUM_MET'
        ? `Đạt tối thiểu 1.3L+ nước lọc (${formatL(completedMl)}/${formatL(targetMl)} L)`
        : status === 'PROGRESSING'
          ? `Đang bổ sung tốt (${formatL(completedMl)}/${formatL(targetMl)} L)`
          : completedMl > 0
            ? `Cần uống thêm nước lọc (${formatL(completedMl)}/${formatL(targetMl)} L)`
            : `Chưa uống nước hôm nay (Mục tiêu ${formatL(targetMl)} L)`);

  return {
    cupMl,
    targetCups,
    targetMl,
    completedCups,
    completedMl,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    status,
    evaluationText,
    completedLitersLabel: formatL(completedMl),
    targetLitersLabel: formatL(targetMl),
  };
}

export function getCurrentHHmm(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function extractHHmm(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.includes('T')) {
    const match = trimmed.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : null;
  }
  const match = trimmed.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

interface CareRoutineState {
  todayMeds: MedicationLog[];
  todayRoutine: DailyRoutineOverviewDto | null;
  loading: boolean;
  confirmingKey: string | null;
  lastSyncedAt: string | null;
  clockHHmm: string;
  mutedReminderKeys: string[];

  setClockHHmm: (hhmm: string) => void;
  fetchElderlyTodayData: (silent?: boolean) => Promise<void>;
  confirmMedicationLog: (logId: number, note?: string) => Promise<boolean>;
  confirmRoutineLog: (logId: number, note?: string) => Promise<DailyRoutineOverviewDto | null>;
  quickAddWater: () => Promise<DailyRoutineOverviewDto | null>;
  muteReminderKeys: (keys: string[]) => void;
  clearMutedReminderKeys: (keys?: string[]) => void;
  resetStore: () => void;
}

export const useCareRoutineStore = create<CareRoutineState>((set, get) => ({
  todayMeds: [],
  todayRoutine: null,
  loading: false,
  confirmingKey: null,
  lastSyncedAt: null,
  clockHHmm: getCurrentHHmm(),
  mutedReminderKeys: [],

  setClockHHmm: (hhmm: string) => {
    if (get().clockHHmm !== hhmm) {
      set({ clockHHmm: hhmm });
    }
  },

  fetchElderlyTodayData: async (silent = false) => {
    if (!silent && get().lastSyncedAt === null) {
      set({ loading: true });
    }
    try {
      const [routineRes, medsRes] = await Promise.allSettled([
        apiClient<DailyRoutineOverviewDto>('/api/routines/today'),
        apiClient<MedicationLog[]>('/api/medications/today'),
      ]);

      const nextState: Partial<CareRoutineState> = {
        loading: false,
        lastSyncedAt: new Date().toISOString(),
        clockHHmm: getCurrentHHmm(),
      };

      if (routineRes.status === 'fulfilled' && routineRes.value.success && routineRes.value.data) {
        nextState.todayRoutine = routineRes.value.data;
      }

      if (medsRes.status === 'fulfilled' && medsRes.value.success && Array.isArray(medsRes.value.data)) {
        nextState.todayMeds = medsRes.value.data;
      }

      set(nextState);
    } catch {
      set({ loading: false });
    }
  },

  confirmMedicationLog: async (logId: number, note?: string) => {
    const key = `MEDICATION:${logId}`;
    set({ confirmingKey: key });
    try {
      const res = await apiClient(`/api/medications/logs/${logId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'TAKEN',
          note: note ?? 'Tôi đã uống thuốc đúng giờ',
        }),
      });

      if (res.success) {
        set((state) => ({
          todayMeds: state.todayMeds.map((m) =>
            m.id === logId ? { ...m, status: 'TAKEN', takenTime: new Date().toISOString() } : m
          ),
          mutedReminderKeys: state.mutedReminderKeys.filter((k) => k !== key),
        }));
        await get().fetchElderlyTodayData(true);
        return true;
      }
      return false;
    } finally {
      set({ confirmingKey: null });
    }
  },

  confirmRoutineLog: async (logId: number, note?: string) => {
    const routineLog = get().todayRoutine?.logs?.find((l) => l.id === logId);
    const key = routineLog ? `${routineLog.routineType}:${logId}` : `ROUTINE:${logId}`;
    set({ confirmingKey: key });
    try {
      const res = await apiClient<DailyRoutineOverviewDto>(`/api/routines/logs/${logId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'COMPLETED',
          note: note ?? 'Người cao tuổi đã xác nhận hoàn thành',
        }),
      });

      if (res.success && res.data) {
        set((state) => ({
          todayRoutine: res.data,
          mutedReminderKeys: state.mutedReminderKeys.filter((k) => k !== key),
        }));
        await get().fetchElderlyTodayData(true);
        return res.data;
      }
      return null;
    } finally {
      set({ confirmingKey: null });
    }
  },

  quickAddWater: async () => {
    set({ confirmingKey: 'WATER_QUICK_ADD' });
    try {
      const res = await apiClient<DailyRoutineOverviewDto>('/api/routines/water/quick-add', {
        method: 'POST',
      });
      if (res.success && res.data) {
        set({ todayRoutine: res.data });
        await get().fetchElderlyTodayData(true);
        return res.data;
      }
      return null;
    } finally {
      set({ confirmingKey: null });
    }
  },

  muteReminderKeys: (keys: string[]) => {
    if (keys.length === 0) return;
    set((state) => {
      const merged = new Set([...state.mutedReminderKeys, ...keys]);
      return { mutedReminderKeys: Array.from(merged) };
    });
  },

  clearMutedReminderKeys: (keys?: string[]) => {
    if (!keys) {
      if (get().mutedReminderKeys.length > 0) {
        set({ mutedReminderKeys: [] });
      }
      return;
    }
    const removeSet = new Set(keys);
    set((state) => ({
      mutedReminderKeys: state.mutedReminderKeys.filter((k) => !removeSet.has(k)),
    }));
  },

  resetStore: () => {
    set({
      todayMeds: [],
      todayRoutine: null,
      loading: false,
      confirmingKey: null,
      lastSyncedAt: null,
      clockHHmm: getCurrentHHmm(),
      mutedReminderKeys: [],
    });
  },
}));
