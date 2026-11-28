import { Dose } from "../api/contracts";
import { planReminders, reminderId } from "./reconcile";
const now = Date.parse("2026-11-08T00:00:00Z");
const dose: Dose = {
  id: 1,
  occurrenceId: "dose-one",
  medicationId: 1,
  medicationName: "Synthetic",
  dosage: "unit",
  scheduledTime: "2026-11-08T09:00:00",
  scheduledAt: "2026-11-08T02:00:00Z",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "PENDING",
  canceled: false,
};
test("retains an identical local mirror instead of scheduling a duplicate", () => {
  const local = {
    id: reminderId(dose.occurrenceId),
    ownerId: "1",
    occurrenceId: dose.occurrenceId,
    scheduledAt: dose.scheduledAt,
  };
  const plan = planReminders(1, [dose, dose], [local], now);
  expect(plan.cancel).toEqual([]);
  expect(plan.schedule).toEqual([]);
  expect(plan.desired).toHaveLength(1);
});
test("reschedule cancels the old instant and creates the replacement", () => {
  const local = {
    id: reminderId(dose.occurrenceId),
    ownerId: "1",
    occurrenceId: dose.occurrenceId,
    scheduledAt: "2026-11-08T01:00:00Z",
  };
  const plan = planReminders(1, [dose], [local], now);
  expect(plan.cancel).toEqual([local.id]);
  expect(plan.schedule).toEqual([dose]);
});
test("canceled and explicitly confirmed occurrences are removed locally", () => {
  for (const changed of [
    { ...dose, canceled: true },
    { ...dose, status: "TAKEN" as const },
  ]) {
    const plan = planReminders(
      1,
      [changed],
      [
        {
          id: reminderId(dose.occurrenceId),
          ownerId: "1",
          occurrenceId: dose.occurrenceId,
          scheduledAt: dose.scheduledAt,
        },
      ],
      now,
    );
    expect(plan.schedule).toEqual([]);
    expect(plan.cancel).toHaveLength(1);
  }
});
test("an account change cannot retain another users local mirror", () => {
  const plan = planReminders(
    2,
    [],
    [
      {
        id: reminderId(dose.occurrenceId),
        ownerId: "1",
        occurrenceId: dose.occurrenceId,
        scheduledAt: dose.scheduledAt,
      },
    ],
    now,
  );
  expect(plan.cancel).toHaveLength(1);
});
