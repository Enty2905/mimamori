import { dateInZone, doseTime } from "./time";
test("formats actual ISO instants as clock times rather than date prefixes", () => {
  expect(doseTime("2026-11-08T02:30:00Z", "Asia/Tokyo", "ja")).toBe("11:30");
  expect(doseTime("2026-11-08T02:30:00Z", "Asia/Ho_Chi_Minh", "vi")).toBe(
    "09:30",
  );
});
test("local medication dates do not accidentally use UTC yesterday", () => {
  expect(dateInZone(new Date("2026-11-08T16:30:00Z"), "Asia/Tokyo")).toBe(
    "2026-11-09",
  );
});
