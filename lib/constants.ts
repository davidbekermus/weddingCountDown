export const COUPLE = {
  bride: "Adina",
  groom: "Dovid",
  weddingDate: "2026-09-02T18:00:00+03:00",
  weddingDateLabel: "September 2, 2026",
};

export const ALLOWED_EMAILS = [
  "davidbekermus@gmail.com",
  "adina.segel1@gmail.com",
] as const;

export const PARTNER_BY_EMAIL: Record<(typeof ALLOWED_EMAILS)[number], string> = {
  "davidbekermus@gmail.com": "adina.segel1@gmail.com",
  "adina.segel1@gmail.com": "davidbekermus@gmail.com",
};

export const MESSAGE_TYPES = [
  "Nice note",
  "Funny picture",
  "Reason I'm marrying you",
  "Funny message",
  "Daily saying",
] as const;

export const APP_TIME_ZONE = "Asia/Jerusalem";

export function isAllowedEmail(email: string | null | undefined) {
  return ALLOWED_EMAILS.includes(
    (email ?? "").toLowerCase() as (typeof ALLOWED_EMAILS)[number],
  );
}
