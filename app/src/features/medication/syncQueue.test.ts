import { drainConfirmations, QueueDependencies } from "./syncQueue";
import { ApiError } from "../../core/api/client";
import { QueuedConfirmation } from "../../core/storage/medicationStore";
const item: QueuedConfirmation = {
  owner: 1,
  occurrence_id: "occurrence-one",
  dose_id: 1,
  status: "TAKEN",
  confirmed_at: "2026-11-08T01:00:00Z",
  error_code: null,
};
function dependencies(): QueueDependencies {
  return {
    currentOwner: () => 1,
    list: jest.fn(async () => [item]),
    send: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    conflict: jest.fn(async () => {}),
  };
}
test("a network failure retains the original confirmation for restart/retry", async () => {
  const deps = dependencies();
  deps.send = jest.fn(async () => {
    throw new ApiError(0, "NETWORK_UNAVAILABLE");
  });
  await drainConfirmations(1, deps);
  expect(deps.remove).not.toHaveBeenCalled();
  expect(deps.conflict).not.toHaveBeenCalled();
});
test("a confirmed server response removes the queued record once", async () => {
  const deps = dependencies();
  await drainConfirmations(1, deps);
  expect(deps.remove).toHaveBeenCalledWith(1, item.occurrence_id);
  expect(deps.send).toHaveBeenCalledWith(item);
});
test("a schedule conflict is surfaced and is not retried silently", async () => {
  const deps = dependencies();
  deps.send = jest.fn(async () => {
    throw new ApiError(409, "CONFLICT");
  });
  await drainConfirmations(1, deps);
  expect(deps.conflict).toHaveBeenCalledWith(1, item.occurrence_id, "CONFLICT");
  expect(deps.remove).not.toHaveBeenCalled();
});
test("switching accounts during sync stops all remaining submissions", async () => {
  const deps = dependencies();
  let owner: number | null = 1;
  deps.currentOwner = () => owner;
  deps.send = jest.fn(async () => {
    owner = 2;
  });
  await drainConfirmations(1, deps);
  expect(deps.remove).not.toHaveBeenCalled();
});
