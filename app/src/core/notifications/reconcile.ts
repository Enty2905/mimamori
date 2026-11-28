import { Dose } from "../api/contracts";
export interface LocalReminder {
  id: string;
  ownerId: string;
  occurrenceId: string;
  scheduledAt: string;
}
export function reminderId(occurrenceId: string) {
  return `mimamori-dose-${occurrenceId}`;
}
export function planReminders(
  owner: number,
  doses: Dose[],
  existing: LocalReminder[],
  now: number,
  limit = 48,
) {
  const eligible = doses
    .filter(
      (dose) =>
        !dose.canceled &&
        dose.status === "PENDING" &&
        Date.parse(dose.scheduledAt) > now,
    )
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const desired = [
    ...new Map(eligible.map((dose) => [dose.occurrenceId, dose])).values(),
  ].slice(0, limit);
  const wanted = new Map(
    desired.map((dose) => [reminderId(dose.occurrenceId), dose]),
  );
  const keep = new Set<string>();
  const cancel: string[] = [];
  for (const local of existing) {
    const dose = wanted.get(local.id);
    if (
      local.ownerId === String(owner) &&
      dose?.scheduledAt === local.scheduledAt
    )
      keep.add(local.id);
    else cancel.push(local.id);
  }
  return {
    cancel,
    schedule: desired.filter(
      (dose) => !keep.has(reminderId(dose.occurrenceId)),
    ),
    desired,
    limited: eligible.length > limit,
  };
}
