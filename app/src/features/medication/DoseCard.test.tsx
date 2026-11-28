import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import "../../core/localization/i18n";
import { DoseCard } from "./DoseCard";
import { Dose } from "../../core/api/contracts";
import { useConfirmDose, useQueuedConfirmations } from "./queries";
jest.mock("./queries", () => ({
  useConfirmDose: jest.fn(),
  useQueuedConfirmations: jest.fn(),
}));
const dose: Dose = {
  id: 1,
  occurrenceId: "synthetic-dose",
  medicationId: 1,
  medicationName: "Thuốc mẫu",
  dosage: "Dữ liệu tổng hợp",
  scheduledTime: "2026-11-09T08:00:00",
  scheduledAt: "2026-11-09T01:00:00Z",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "PENDING",
  canceled: false,
};
const mutate = jest.fn();
beforeEach(() => {
  mutate.mockReset();
  jest
    .mocked(useConfirmDose)
    .mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useConfirmDose>);
  jest
    .mocked(useQueuedConfirmations)
    .mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useQueuedConfirmations
    >);
});
test("one explicit accessible action submits the identified dose", async () => {
  const screen = await render(<DoseCard dose={dose} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Tôi đã uống cữ thuốc này" }),
  );
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate).toHaveBeenCalledWith(dose);
  expect(screen.getByText("Giờ uống: 08:00")).toBeTruthy();
});
test("an offline confirmation is visibly pending and cannot be submitted twice", async () => {
  jest
    .mocked(useQueuedConfirmations)
    .mockReturnValue({
      data: [{ occurrence_id: dose.occurrenceId, error_code: null }],
    } as unknown as ReturnType<typeof useQueuedConfirmations>);
  const screen = await render(<DoseCard dose={dose} />);
  expect(screen.getByText("Đã lưu trên máy, đang chờ đồng bộ")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Tôi đã uống cữ thuốc này" }),
  ).toBeNull();
});
test("confirmed doses do not offer another confirmation action", async () => {
  const screen = await render(<DoseCard dose={{ ...dose, status: "TAKEN" }} />);
  expect(screen.getByText("Đã uống")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Tôi đã uống cữ thuốc này" }),
  ).toBeNull();
});
