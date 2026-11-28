import * as SQLite from "expo-sqlite";
import { z } from "zod";
import { Dose, doseSchema } from "../api/contracts";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  database ??= (async () => {
    const value = await SQLite.openDatabaseAsync("mimamori-care.db");
    await value.execAsync(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS medication_cache(owner INTEGER NOT NULL,cache_key TEXT NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,cache_key));
    CREATE TABLE IF NOT EXISTS confirmation_queue(owner INTEGER NOT NULL,occurrence_id TEXT NOT NULL,dose_id INTEGER NOT NULL,status TEXT NOT NULL,confirmed_at TEXT NOT NULL,error_code TEXT,PRIMARY KEY(owner,occurrence_id));`);
    return value;
  })();
  try {
    return await database;
  } catch (error) {
    database = undefined;
    throw error;
  }
}
export interface QueuedConfirmation {
  owner: number;
  occurrence_id: string;
  dose_id: number;
  status: "TAKEN" | "SKIPPED";
  confirmed_at: string;
  error_code: string | null;
}
export async function cacheDoses(owner: number, key: string, items: Dose[]) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO medication_cache(owner,cache_key,payload,updated_at) VALUES (?,?,?,?)",
    owner,
    key,
    JSON.stringify(items),
    new Date().toISOString(),
  );
}
export async function cachedDoses(owner: number, key: string) {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string; updated_at: string }>(
    "SELECT payload,updated_at FROM medication_cache WHERE owner=? AND cache_key=?",
    owner,
    key,
  );
  if (!row) return null;
  const parsed = z.array(doseSchema).safeParse(JSON.parse(row.payload));
  return parsed.success
    ? { items: parsed.data, updatedAt: row.updated_at }
    : null;
}
export async function enqueueConfirmation(
  owner: number,
  dose: Dose,
  status: "TAKEN" | "SKIPPED",
) {
  await (
    await db()
  ).runAsync(
    "INSERT OR IGNORE INTO confirmation_queue(owner,occurrence_id,dose_id,status,confirmed_at) VALUES (?,?,?,?,?)",
    owner,
    dose.occurrenceId,
    dose.id,
    status,
    new Date().toISOString(),
  );
}
export async function queuedConfirmations(owner: number) {
  return (await db()).getAllAsync<QueuedConfirmation>(
    "SELECT * FROM confirmation_queue WHERE owner=? ORDER BY confirmed_at",
    owner,
  );
}
export async function removeConfirmation(owner: number, occurrenceId: string) {
  await (
    await db()
  ).runAsync(
    "DELETE FROM confirmation_queue WHERE owner=? AND occurrence_id=?",
    owner,
    occurrenceId,
  );
}
export async function markConfirmationConflict(
  owner: number,
  occurrenceId: string,
  code: string,
) {
  await (
    await db()
  ).runAsync(
    "UPDATE confirmation_queue SET error_code=? WHERE owner=? AND occurrence_id=?",
    code,
    owner,
    occurrenceId,
  );
}
