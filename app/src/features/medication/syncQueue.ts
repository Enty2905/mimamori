import { ApiError } from "../../core/api/client";
import { QueuedConfirmation } from "../../core/storage/medicationStore";
export interface QueueDependencies {
  currentOwner: () => number | null;
  list: (owner: number) => Promise<QueuedConfirmation[]>;
  send: (item: QueuedConfirmation) => Promise<unknown>;
  remove: (owner: number, id: string) => Promise<void>;
  conflict: (owner: number, id: string, code: string) => Promise<void>;
}
/** One bounded pass; ownership is checked again before every request and local mutation. */
export async function drainConfirmations(
  owner: number,
  deps: QueueDependencies,
) {
  if (deps.currentOwner() !== owner) return;
  for (const item of (await deps.list(owner)).slice(0, 20)) {
    if (deps.currentOwner() !== owner) return;
    if (item.error_code) continue;
    try {
      await deps.send(item);
      if (deps.currentOwner() !== owner) return;
      await deps.remove(owner, item.occurrence_id);
    } catch (error) {
      if (deps.currentOwner() !== owner) return;
      if (
        error instanceof ApiError &&
        [400, 403, 404, 409].includes(error.status)
      )
        await deps.conflict(owner, item.occurrence_id, error.code);
      else return;
    }
  }
}
