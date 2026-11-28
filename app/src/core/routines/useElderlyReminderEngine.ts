import { useEffect, useMemo, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import {
  useCareRoutineStore,
  extractHHmm,
  getCurrentHHmm,
  type MedicationLog,
  type DailyRoutineOverviewDto,
} from './useCareRoutineStore';

export type DueReminderKind = 'MEDICATION' | 'WATER' | 'SLEEP';

export interface DueReminderItem {
  key: string;
  kind: DueReminderKind;
  logId: number;
  title: string;
  subtitle: string;
  scheduledTime: string;
  confirmLabel: 'Tôi đã uống' | 'Tôi đã đi ngủ';
}

const KIND_PRIORITY: Record<DueReminderKind, number> = {
  MEDICATION: 0,
  WATER: 1,
  SLEEP: 2,
};

export function computeDueReminders(
  todayMeds: MedicationLog[],
  todayRoutine: DailyRoutineOverviewDto | null,
  nowHHmm: string
): DueReminderItem[] {
  const items: DueReminderItem[] = [];

  for (const med of todayMeds) {
    if (med.status !== 'PENDING') continue;
    const hhmm = extractHHmm(med.scheduledTime);
    if (!hhmm || hhmm > nowHHmm) continue;

    items.push({
      key: `MEDICATION:${med.id}`,
      kind: 'MEDICATION',
      logId: med.id,
      title: 'ĐẾN GIỜ UỐNG THUỐC',
      subtitle: `${med.medicationName} • ${med.dosage}${med.instruction ? ` (${med.instruction})` : ''}`,
      scheduledTime: hhmm,
      confirmLabel: 'Tôi đã uống',
    });
  }

  if (todayRoutine && Array.isArray(todayRoutine.logs)) {
    for (const log of todayRoutine.logs) {
      if (log.status !== 'PENDING') continue;
      const hhmm = extractHHmm(log.scheduledTime);
      if (!hhmm || hhmm > nowHHmm) continue;

      if (log.routineType === 'WATER' && todayRoutine.waterEnabled) {
        const cupMl = todayRoutine.waterCupMl ?? 200;
        const completedMl =
          todayRoutine.waterCompletedMl ?? todayRoutine.waterCompletedCups * cupMl;
        const targetMl =
          todayRoutine.waterTargetMl ?? todayRoutine.waterTargetCups * cupMl;
        const formatL = (ml: number) =>
          ml <= 0 ? '0' : ml % 100 === 0 ? (ml / 1000).toFixed(1) : (ml / 1000).toFixed(2);
        items.push({
          key: `WATER:${log.id}`,
          kind: 'WATER',
          logId: log.id,
          title: 'ĐẾN GIỜ UỐNG NƯỚC',
          subtitle: `Uống 1 ly ${cupMl}ml (${formatL(completedMl)}/${formatL(targetMl)} L • ${todayRoutine.waterCompletedCups}/${todayRoutine.waterTargetCups} ly)`,
          scheduledTime: hhmm,
          confirmLabel: 'Tôi đã uống',
        });
      } else if (log.routineType === 'SLEEP' && todayRoutine.sleepEnabled) {
        items.push({
          key: `SLEEP:${log.id}`,
          kind: 'SLEEP',
          logId: log.id,
          title: 'ĐẾN GIỜ ĐI NGỦ',
          subtitle: `Chuẩn bị nghỉ ngơi lúc ${hhmm} • Mục tiêu ${todayRoutine.sleepTargetHours}h`,
          scheduledTime: hhmm,
          confirmLabel: 'Tôi đã đi ngủ',
        });
      }
    }
  }

  return items.sort((a, b) => {
    const timeCmp = b.scheduledTime.localeCompare(a.scheduledTime);
    if (timeCmp !== 0) return timeCmp;
    return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
  });
}

// Shared singleton audio player controller so confirming from any screen stops sound synchronously.
let sharedPlayer: AudioPlayer | null = null;
let isSoundActive = false;
let soundSessionSeq = 0;
let notificationHandlerConfigured = false;

export async function startReminderSound(): Promise<void> {
  if (isSoundActive) return;
  const currentSeq = ++soundSessionSeq;

  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // Ignore audio mode errors on unsupported environments
  }

  if (currentSeq !== soundSessionSeq) {
    return;
  }

  try {
    if (!sharedPlayer) {
      const chimeAsset = require('../../../assets/sounds/reminder_chime.wav');
      sharedPlayer = createAudioPlayer(chimeAsset);
    }
    if (currentSeq !== soundSessionSeq) {
      return;
    }
    sharedPlayer.muted = false;
    sharedPlayer.volume = 1;
    sharedPlayer.loop = true;
    sharedPlayer.play();
    isSoundActive = currentSeq === soundSessionSeq;
  } catch {
    isSoundActive = false;
  }
}

export function stopReminderSoundImmediately(): void {
  soundSessionSeq += 1;
  isSoundActive = false;
  try {
    if (sharedPlayer) {
      sharedPlayer.muted = true;
      sharedPlayer.volume = 0;
      sharedPlayer.loop = false;
      sharedPlayer.pause();
      sharedPlayer.seekTo(0).catch(() => {});
      sharedPlayer.remove();
      sharedPlayer = null;
    }
  } catch {
    sharedPlayer = null;
  }
}

export function releaseReminderSound(): void {
  stopReminderSoundImmediately();
}

export function muteCurrentDueReminders(kind?: 'MEDICATION' | 'WATER' | 'SLEEP'): void {
  const store = useCareRoutineStore.getState();
  const due = computeDueReminders(store.todayMeds, store.todayRoutine, getCurrentHHmm());
  const keys = due
    .filter((item) => !kind || item.kind === kind)
    .map((item) => item.key);
  if (keys.length > 0) {
    store.muteReminderKeys(keys);
  }
}

export async function dismissReminderNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Safe guard for Expo Go or unsupported environments
  }
}

export async function confirmDueReminder(reminder: DueReminderItem): Promise<boolean> {
  // Immediately silence alarm, mute the active overdue batch & clear notifications BEFORE awaiting API
  stopReminderSoundImmediately();
  dismissReminderNotifications().catch(() => {});
  muteCurrentDueReminders();

  const store = useCareRoutineStore.getState();
  if (reminder.kind === 'MEDICATION') {
    return store.confirmMedicationLog(reminder.logId, 'Tôi đã uống thuốc đúng giờ');
  }
  const note = reminder.kind === 'SLEEP' ? 'Tôi đã đi ngủ đúng giờ' : 'Tôi đã uống nước đúng giờ';
  const updated = await store.confirmRoutineLog(reminder.logId, note);
  return updated !== null;
}

export function useDueRemindersState() {
  const todayMeds = useCareRoutineStore((s) => s.todayMeds);
  const todayRoutine = useCareRoutineStore((s) => s.todayRoutine);
  const clockHHmm = useCareRoutineStore((s) => s.clockHHmm);
  const mutedReminderKeys = useCareRoutineStore((s) => s.mutedReminderKeys);
  const muteReminderKeys = useCareRoutineStore((s) => s.muteReminderKeys);
  const clearMutedReminderKeys = useCareRoutineStore((s) => s.clearMutedReminderKeys);

  const dueReminders = useMemo(
    () => computeDueReminders(todayMeds, todayRoutine, clockHHmm),
    [todayMeds, todayRoutine, clockHHmm]
  );

  const activeAlarmReminder = dueReminders[0] ?? null;

  const isAlarmMuted = useMemo(() => {
    if (dueReminders.length === 0) return false;
    const mutedSet = new Set(mutedReminderKeys);
    return dueReminders.every((item) => mutedSet.has(item.key));
  }, [dueReminders, mutedReminderKeys]);

  const muteAlarm = useCallback(() => {
    stopReminderSoundImmediately();
    muteReminderKeys(dueReminders.map((item) => item.key));
  }, [dueReminders, muteReminderKeys]);

  const unmuteAlarm = useCallback(() => {
    clearMutedReminderKeys(dueReminders.map((item) => item.key));
  }, [dueReminders, clearMutedReminderKeys]);

  return {
    dueReminders,
    activeAlarmReminder,
    isAlarmMuted,
    confirmReminder: confirmDueReminder,
    muteAlarm,
    unmuteAlarm,
  };
}

export function useElderlyReminderEngine(enabled: boolean) {
  const fetchElderlyTodayData = useCareRoutineStore((s) => s.fetchElderlyTodayData);
  const setClockHHmm = useCareRoutineStore((s) => s.setClockHHmm);
  const clearMutedReminderKeys = useCareRoutineStore((s) => s.clearMutedReminderKeys);
  const resetStore = useCareRoutineStore((s) => s.resetStore);

  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const wasEnabledRef = useRef(false);

  const {
    dueReminders,
    activeAlarmReminder,
    isAlarmMuted,
    confirmReminder,
    muteAlarm,
    unmuteAlarm,
  } = useDueRemindersState();

  // Configure local notification permissions & foreground handler safely
  useEffect(() => {
    if (!enabled) return;

    try {
      if (!notificationHandlerConfigured) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        notificationHandlerConfigured = true;
      }

      (async () => {
        try {
          const current = await Notifications.getPermissionsAsync();
          if (current.status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
        } catch {
          // Ignore permission errors in Expo Go
        }
      })();
    } catch {
      // Ignore notification setup errors
    }
  }, [enabled]);

  // 10-second polling + AppState 'active' refresh
  useEffect(() => {
    if (!enabled) {
      if (wasEnabledRef.current) {
        wasEnabledRef.current = false;
        notifiedKeysRef.current.clear();
        releaseReminderSound();
        dismissReminderNotifications().catch(() => {});
        resetStore();
      }
      return;
    }

    wasEnabledRef.current = true;
    setClockHHmm(getCurrentHHmm());
    fetchElderlyTodayData();

    const intervalId = setInterval(() => {
      setClockHHmm(getCurrentHHmm());
      fetchElderlyTodayData(true);
    }, 10000);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setClockHHmm(getCurrentHHmm());
        fetchElderlyTodayData(true);
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [enabled, fetchElderlyTodayData, resetStore, setClockHHmm]);

  // Drive looping alarm audio & OS local notifications
  useEffect(() => {
    if (!enabled) {
      stopReminderSoundImmediately();
      return;
    }

    const activeKeys = new Set(dueReminders.map((r) => r.key));
    for (const oldKey of Array.from(notifiedKeysRef.current)) {
      if (!activeKeys.has(oldKey)) {
        notifiedKeysRef.current.delete(oldKey);
      }
    }

    if (dueReminders.length === 0) {
      stopReminderSoundImmediately();
      clearMutedReminderKeys();
      dismissReminderNotifications().catch(() => {});
      return;
    }

    // Present local notification once per newly-due reminder
    for (const item of dueReminders) {
      if (!notifiedKeysRef.current.has(item.key)) {
        notifiedKeysRef.current.add(item.key);
        try {
          Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body: `${item.subtitle} (${item.scheduledTime})`,
              sound: 'default',
              data: { key: item.key, kind: item.kind, logId: item.logId },
            },
            trigger: null,
          }).catch(() => {});
        } catch {
          // Safe guard for Expo Go
        }
      }
    }

    if (!isAlarmMuted) {
      startReminderSound().catch(() => {});
    } else {
      stopReminderSoundImmediately();
    }
  }, [enabled, dueReminders, isAlarmMuted, clearMutedReminderKeys]);

  // Cleanup audio on full unmount
  useEffect(() => {
    return () => {
      releaseReminderSound();
    };
  }, []);

  return {
    dueReminders,
    activeAlarmReminder,
    isAlarmMuted,
    confirmReminder,
    muteAlarm,
    unmuteAlarm,
  };
}
