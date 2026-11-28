export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
}
export function dateInZone(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) =>
    parts.find((value) => value.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function doseTime(instant: string, zone: string, language: string = 'vi') {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "vi-VN", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(instant));
}
