import { APP_TIME_ZONE } from "./constants";

export function getDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function canEditTodayMessage(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return hour < 8;
}

export function toCountdownParts(targetIso: string, now = new Date()) {
  const delta = Math.max(new Date(targetIso).getTime() - now.getTime(), 0);
  const days = Math.floor(delta / 86_400_000);
  const hours = Math.floor((delta / 3_600_000) % 24);
  const minutes = Math.floor((delta / 60_000) % 60);
  const seconds = Math.floor((delta / 1_000) % 60);

  return { days, hours, minutes, seconds };
}
