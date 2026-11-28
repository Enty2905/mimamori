import { z } from "zod";
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: z.enum(["ELDERLY", "CAREGIVER"]),
  phone: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  emergencyContact: z.string().nullish(),
  languagePreference: z.string().nullish(),
  timeZone: z.string().nullish(),
});
export type User = z.infer<typeof userSchema>;
export const authSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: userSchema,
});
export const doseSchema = z.object({
  id: z.number(),
  occurrenceId: z.string(),
  medicationId: z.number(),
  medicationName: z.string(),
  dosage: z.string(),
  instructions: z.string().nullish(),
  scheduledTime: z.string(),
  scheduledAt: z.string().datetime(),
  timeZone: z.string(),
  status: z.enum(["PENDING", "TAKEN", "SKIPPED", "MISSED"]),
  canceled: z.boolean(),
  confirmedAt: z.string().nullish(),
});
export type Dose = z.infer<typeof doseSchema>;
export const familySchema = z.object({
  relationshipId: z.number(),
  member: userSchema,
  relationshipType: z.string().nullish(),
  status: z.string(),
});
export const alertSchema = z.object({
  id: z.number(),
  elderlyId: z.number(),
  alertType: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string(),
  title: z.string().nullish(),
  isResolved: z.boolean(),
  isRead: z.boolean(),
  createdAt: z.string(),
});
export type CareAlert = z.infer<typeof alertSchema>;
export const checkinSchema = z.object({
  id: z.number(),
  concerningFlag: z.boolean(),
  mood: z.string(),
  physicalHealth: z.string(),
  sleepQuality: z.string(),
  appetite: z.string(),
  checkinDate: z.string(),
  aiAnalysisSummary: z.string().nullish(),
});
export type CheckIn = z.infer<typeof checkinSchema>;
