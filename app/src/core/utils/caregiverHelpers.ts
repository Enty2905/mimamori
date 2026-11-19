import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export type FeatherIconName = keyof typeof Feather.glyphMap;

export interface CaregiverUserDto {
  id: number;
  username: string;
  email?: string;
  fullName: string;
  role: string;
  phone?: string | null;
  emergencyContact?: string | null;
  avatarUrl?: string | null;
}

export interface FamilyMemberDto {
  relationshipId: number;
  member: CaregiverUserDto;
  relationshipType: string;
  status: string;
  canViewConversations?: boolean;
  linkedAt?: string;
}

export interface MedicationScheduleDto {
  id: number;
  reminderTime: string;
  dosageAmount?: string | null;
  daysOfWeek?: string | null;
}

export interface MedicationDto {
  id: number;
  elderlyId: number;
  name: string;
  dosage: string;
  instructions?: string | null;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  schedules?: MedicationScheduleDto[];
  createdAt?: string;
}

export type HealthConditionStatus = 'STABLE' | 'MONITORING' | 'WORSENING' | 'RECOVERED';
export type HealthConditionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface HealthConditionDto {
  id: number;
  elderlyId: number;
  createdByName?: string | null;
  conditionName: string;
  status: HealthConditionStatus | string;
  severity: HealthConditionSeverity | string;
  recordDate: string;
  nextCheckupDate?: string | null;
  doctorOrClinic?: string | null;
  symptomsOrNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicationLogDto {
  id: number;
  scheduleId?: number;
  medicationId: number;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  takenTime?: string | null;
  status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED';
  notes?: string | null;
}

export interface CareAlertDto {
  id: number;
  elderlyId: number;
  elderlyName?: string;
  caregiverId?: number;
  alertType:
    | 'MISSED_MEDICATION'
    | 'MISSED_CHECKIN'
    | 'CHECKIN_CONCERN'
    | 'EMERGENCY_BUTTON'
    | 'SYSTEM_NOTIFICATION'
    | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  title?: string;
  description: string;
  isRead?: boolean;
  isResolved?: boolean;
  resolved?: boolean;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface DailyCheckInDto {
  id: number;
  elderlyId: number;
  checkinDate: string;
  mood: string;
  physicalHealth: string;
  sleepQuality: string;
  appetite: string;
  notes?: string | null;
  concerningFlag?: boolean;
  aiAnalysisSummary?: string | null;
  createdAt?: string;
}

export interface DailySummaryDto {
  id?: number;
  summaryDate: string;
  medicationAdherenceRate: number;
  checkinSummary?: string;
  alertCount?: number;
  aiHealthNote?: string;
}

export interface StatusBadgeMeta {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export interface CareStatusMeta extends StatusBadgeMeta {
  icon: FeatherIconName;
}

export type MedicationDisplayStatusKey =
  | 'TAKEN'
  | 'MISSED'
  | 'OVERDUE'
  | 'PENDING'
  | 'UPCOMING'
  | 'SKIPPED';

export interface MedicationDisplayStatusMeta extends StatusBadgeMeta {
  key: MedicationDisplayStatusKey;
  icon: FeatherIconName;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

const hasExplicitTimezone = (iso: string): boolean =>
  /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());

/**
 * Parses an ISO date-time or time-only string into a local Date instance.
 * Naive ISO timestamps (without Z or offset) are interpreted in local time
 * to stay consistent with backend LocalDateTime values across JS engines.
 */
export function parseIsoDateTime(
  value?: string | null,
  fallbackDate: Date = new Date()
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const timeOnlyMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    const seconds = Number(timeOnlyMatch[3] ?? '0');
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return new Date(
      fallbackDate.getFullYear(),
      fallbackDate.getMonth(),
      fallbackDate.getDate(),
      hours,
      minutes,
      seconds
    );
  }

  if (!hasExplicitTimezone(trimmed)) {
    const localIsoMatch =
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(trimmed);
    if (localIsoMatch) {
      const year = Number(localIsoMatch[1]);
      const month = Number(localIsoMatch[2]) - 1;
      const day = Number(localIsoMatch[3]);
      const hours = Number(localIsoMatch[4]);
      const minutes = Number(localIsoMatch[5]);
      const seconds = Number(localIsoMatch[6] ?? '0');
      const parsed = new Date(year, month, day, hours, minutes, seconds);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats an ISO timestamp (LocalDateTime, Instant, or HH:mm) to local "HH:mm".
 */
export function formatTimeHHMM(iso?: string | null): string {
  const parsed = parseIsoDateTime(iso);
  if (!parsed) return '--:--';
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

/**
 * Formats a Date as a local "YYYY-MM-DD" key.
 */
export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const startOfLocalDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const VI_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/**
 * Formats a Date in Vietnamese for display, e.g. "Hôm nay • 19/11" or "Hôm qua • 18/11".
 */
export function formatDateDisplayVi(d: Date, referenceNow: Date = new Date()): string {
  const targetDay = startOfLocalDay(d);
  const today = startOfLocalDay(referenceNow);
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const ddmm = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

  if (diffDays === 0) return `Hôm nay • ${ddmm}`;
  if (diffDays === -1) return `Hôm qua • ${ddmm}`;
  if (diffDays === 1) return `Ngày mai • ${ddmm}`;
  return `${VI_WEEKDAYS[d.getDay()]} • ${ddmm}`;
}

/**
 * Normalizes backend alert resolution flags (handles both `isResolved` and `resolved`).
 */
export function isAlertResolved(a: CareAlertDto): boolean {
  return Boolean(a.isResolved ?? a.resolved);
}

const ALERT_TITLES: Record<string, string> = {
  MISSED_MEDICATION: 'Bỏ lỡ lịch uống thuốc',
  MISSED_CHECKIN: 'Chưa hoàn thành điểm danh',
  CHECKIN_CONCERN: 'Dấu hiệu sức khỏe cần chú ý',
  EMERGENCY_BUTTON: 'Tín hiệu khẩn cấp SOS',
  SYSTEM_NOTIFICATION: 'Thông báo hệ thống',
};

export function getAlertTitle(alertType?: string, explicitTitle?: string): string {
  const trimmed = explicitTitle?.trim();
  if (trimmed) return trimmed;
  if (alertType && ALERT_TITLES[alertType]) {
    return ALERT_TITLES[alertType];
  }
  return 'Cảnh báo chăm sóc';
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  MISSED_MEDICATION: 'Thuốc',
  MISSED_CHECKIN: 'Điểm danh',
  CHECKIN_CONCERN: 'Sức khỏe',
  EMERGENCY_BUTTON: 'Khẩn cấp',
  SYSTEM_NOTIFICATION: 'Hệ thống',
};

export function getAlertTypeLabel(alertType?: string): string {
  if (alertType && ALERT_TYPE_LABELS[alertType]) {
    return ALERT_TYPE_LABELS[alertType];
  }
  return 'Hệ thống';
}

export function getSeverityMeta(severity?: string): StatusBadgeMeta {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return {
        label: 'Khẩn cấp',
        bg: colors.danger,
        text: colors.dangerText,
        border: colors.dangerBorder,
      };
    case 'HIGH':
      return {
        label: 'Mức cao',
        bg: colors.warning,
        text: colors.warningText,
        border: colors.warningBorder,
      };
    case 'MEDIUM':
      return {
        label: 'Trung bình',
        bg: colors.primaryLight,
        text: colors.primary,
        border: colors.borderLight,
      };
    case 'LOW':
    default:
      return {
        label: 'Thông tin',
        bg: colors.surfaceWarm,
        text: colors.textSecondary,
        border: colors.border,
      };
  }
}

const UPCOMING_THRESHOLD_MS = 30 * 60 * 1000;

export function getMedicationDisplayStatus(
  log: MedicationLogDto,
  referenceNow: Date = new Date()
): MedicationDisplayStatusMeta {
  if (log.status === 'TAKEN') {
    return {
      key: 'TAKEN',
      label: 'Đã uống',
      bg: colors.success,
      text: colors.successText,
      border: colors.successBorder,
      icon: 'check-circle',
    };
  }

  if (log.status === 'MISSED') {
    return {
      key: 'MISSED',
      label: 'Đã bỏ lỡ',
      bg: colors.danger,
      text: colors.dangerText,
      border: colors.dangerBorder,
      icon: 'x-circle',
    };
  }

  if (log.status === 'SKIPPED') {
    return {
      key: 'SKIPPED',
      label: 'Bỏ qua',
      bg: colors.surfaceWarm,
      text: colors.textSecondary,
      border: colors.border,
      icon: 'slash',
    };
  }

  const scheduled = parseIsoDateTime(log.scheduledTime, referenceNow);
  if (scheduled) {
    const diffMs = scheduled.getTime() - referenceNow.getTime();
    if (diffMs < 0) {
      return {
        key: 'OVERDUE',
        label: 'Quá giờ',
        bg: colors.danger,
        text: colors.dangerText,
        border: colors.dangerBorder,
        icon: 'alert-circle',
      };
    }
    if (diffMs > UPCOMING_THRESHOLD_MS) {
      return {
        key: 'UPCOMING',
        label: 'Chưa đến giờ',
        bg: colors.surfaceWarm,
        text: colors.textSecondary,
        border: colors.border,
        icon: 'clock',
      };
    }
  }

  return {
    key: 'PENDING',
    label: 'Chờ uống',
    bg: colors.warning,
    text: colors.warningText,
    border: colors.warningBorder,
    icon: 'bell',
  };
}

export function formatConciseAlertDescription(
  description?: string | null,
  elderlyName?: string | null
): string {
  const raw = description?.trim() ?? '';
  if (!raw) return '';

  const candidates: string[] = [];
  if (elderlyName?.trim()) {
    const cleanName = elderlyName.trim();
    const withoutTitle = cleanName.replace(/^(bác|cụ|ông|bà)\s+/i, '').trim();
    candidates.push(cleanName);
    if (withoutTitle && withoutTitle !== cleanName) {
      candidates.push(withoutTitle);
    }
  }

  let result = raw;
  for (const name of candidates) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(
      `^(?:(?:bác|cụ|ông|bà|người thân)\\s+)?${escaped}(?:\\s*[,:\\-]?\\s*)`,
      'i'
    );
    if (prefixRegex.test(result)) {
      result = result.replace(prefixRegex, '').trim();
      break;
    }
  }

  if (!result) return raw;
  return result.charAt(0).toLocaleUpperCase('vi-VN') + result.slice(1);
}

export function getCareStatusMeta(status?: string): CareStatusMeta {
  switch (status?.toUpperCase()) {
    case 'CRITICAL':
      return {
        label: 'Khẩn cấp',
        bg: colors.danger,
        text: colors.dangerText,
        border: colors.dangerBorder,
        icon: 'alert-octagon',
      };
    case 'NEEDS_ATTENTION':
      return {
        label: 'Cần lưu ý',
        bg: colors.warning,
        text: colors.warningText,
        border: colors.warningBorder,
        icon: 'alert-triangle',
      };
    case 'REMINDER_REQUIRED':
      return {
        label: 'Cần nhắc nhở',
        bg: colors.warning,
        text: colors.warningText,
        border: colors.warningBorder,
        icon: 'bell',
      };
    case 'NORMAL':
    default:
      return {
        label: 'Bình thường',
        bg: colors.success,
        text: colors.successText,
        border: colors.successBorder,
        icon: 'check-circle',
      };
  }
}

export function getHealthConditionStatusMeta(status?: string): CareStatusMeta {
  switch (status?.toUpperCase()) {
    case 'STABLE':
      return {
        label: 'Ổn định',
        bg: colors.success,
        text: colors.successText,
        border: colors.successBorder,
        icon: 'check-circle',
      };
    case 'WORSENING':
      return {
        label: 'Chuyển biến nặng',
        bg: colors.danger,
        text: colors.dangerText,
        border: colors.dangerBorder,
        icon: 'alert-octagon',
      };
    case 'RECOVERED':
      return {
        label: 'Đã khỏi',
        bg: colors.surfaceWarm,
        text: colors.textSecondary,
        border: colors.border,
        icon: 'award',
      };
    case 'MONITORING':
    default:
      return {
        label: 'Cần theo dõi',
        bg: colors.warning,
        text: colors.warningText,
        border: colors.warningBorder,
        icon: 'activity',
      };
  }
}

export function getHealthConditionSeverityMeta(severity?: string): StatusBadgeMeta {
  switch (severity?.toUpperCase()) {
    case 'SEVERE':
      return {
        label: 'Mức độ nặng',
        bg: colors.danger,
        text: colors.dangerText,
        border: colors.dangerBorder,
      };
    case 'MILD':
      return {
        label: 'Mức độ nhẹ',
        bg: colors.success,
        text: colors.successText,
        border: colors.successBorder,
      };
    case 'MODERATE':
    default:
      return {
        label: 'Mức độ vừa',
        bg: colors.warning,
        text: colors.warningText,
        border: colors.warningBorder,
      };
  }
}

export function formatIsoDateToDisplay(isoDate?: string | null): string {
  if (!isoDate) return '';
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function addDaysToIsoDate(baseIsoDate: string, days: number): string {
  const parts = baseIsoDate.split('-').map(Number);
  const date =
    parts.length === 3 && !Number.isNaN(parts[0])
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}
