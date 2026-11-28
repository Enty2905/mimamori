import { z } from "zod";
import { requestData } from "./client";
import {
  alertSchema,
  checkinSchema,
  doseSchema,
  familySchema,
  userSchema,
} from "./contracts";
export const medicationSchema = z.object({
  id: z.number(),
  elderlyId: z.number(),
  name: z.string(),
  dosage: z.string(),
  instructions: z.string().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  timeZone: z.string(),
  isActive: z.boolean(),
  schedules: z.array(z.object({ id: z.number(), reminderTime: z.string() })),
});
export type Medication = z.infer<typeof medicationSchema>;
export const overviewSchema = z
  .object({
    elderly: userSchema.nullish(),
    careStatus: z.string(),
    medicationAdherence: z.number().nullish(),
    todayCheckIn: checkinSchema.nullish(),
    todayMedications: z.array(doseSchema).nullish(),
    activeAlerts: z.array(alertSchema).nullish(),
    recentSummary: z.object({
      summaryDate: z.string(),
      checkinSummary: z.string().nullish(),
      medicationAdherenceRate: z.number().nullish(),
      aiHealthNote: z.string().nullish(),
    }).nullish(),
  })
  .passthrough();
const target = (elderlyId?: number) =>
  elderlyId ? `?elderlyId=${elderlyId}` : "";
const post = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});
export const careApi = {
  profile: () => requestData("/api/users/me", userSchema),
  saveProfile: (body: unknown) =>
    requestData("/api/users/me", userSchema, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    requestData(
      "/api/auth/change-password",
      z.null(),
      post({ currentPassword, newPassword }),
    ),
  today: (id?: number) =>
    requestData("/api/medications/today" + target(id), z.array(doseSchema)),
  upcoming: () => requestData("/api/reminders/upcoming", z.array(doseSchema)),
  history: (id?: number) =>
    requestData("/api/medications/history" + target(id), z.array(doseSchema)),
  confirm: (
    id: number,
    status: "TAKEN" | "SKIPPED",
    confirmedAt: string,
    sessionOwner?: number,
  ) =>
    requestData(`/api/medications/logs/${id}/confirm`, doseSchema, {
      ...post({ status, confirmedAt }),
      sessionOwner,
    }),
  dose: (id: number) => requestData(`/api/medications/logs/${id}`, doseSchema),
  medications: (id?: number) =>
    requestData("/api/medications" + target(id), z.array(medicationSchema)),
  saveMedication: (body: unknown, id?: number) =>
    requestData(
      id ? `/api/medications/${id}` : "/api/medications",
      medicationSchema,
      { method: id ? "PUT" : "POST", body: JSON.stringify(body) },
    ),
  stopMedication: (id: number) =>
    requestData(`/api/medications/${id}`, z.null(), { method: "DELETE" }),
  family: () => requestData("/api/family/members", z.array(familySchema)),
  link: (elderlyUsername: string) =>
    requestData("/api/family/link", familySchema, post({ elderlyUsername })),
  unlink: (id: number) =>
    requestData(`/api/family/link/${id}`, z.null(), { method: "DELETE" }),
  acceptLink: (id: number) =>
    requestData(`/api/family/link/${id}/accept`, familySchema, {
      method: "PUT",
    }),
  overview: (id?: number) =>
    requestData("/api/dashboard/overview" + target(id), overviewSchema),
  alerts: () => requestData("/api/alerts", z.array(alertSchema)),
  resolve: (id: number) =>
    requestData(`/api/alerts/${id}/resolve`, alertSchema, { method: "PUT" }),
  todayCheckin: () =>
    requestData("/api/checkins/today", checkinSchema.nullable()),
  submitCheckin: (body: unknown) =>
    requestData("/api/checkins", checkinSchema, post(body)),
  emergency: (requestId: string) =>
    requestData(
      "/api/emergencies",
      z.object({
        requestId: z.string(),
        status: z.literal("RECORDED"),
        recipientCount: z.number(),
      }),
      post({ requestId }),
    ),
  registerDevice: (id: string, token: string, platform: string) =>
    requestData(`/api/devices/${id}`, z.null(), {
      method: "PUT",
      body: JSON.stringify({ token, platform }),
    }),
  removeDevice: (id: string) =>
    requestData(`/api/devices/${id}`, z.null(), { method: "DELETE" }),
  mirrors: (id: string, occurrenceIds: string[], sessionOwner: number) =>
    requestData(`/api/devices/${id}/mirrors`, z.null(), {
      method: "PUT",
      body: JSON.stringify({ occurrenceIds }),
      sessionOwner,
    }),
};
