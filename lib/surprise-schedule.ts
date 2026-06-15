import { COUPLE } from "./constants";

export type SystemSurpriseSeed = {
  id: string;
  title: string;
  unlockDate: string;
  content: string;
};

export const SYSTEM_SURPRISES: SystemSurpriseSeed[] = [
  {
    id: "two-months",
    title: "Two Months To Forever",
    unlockDate: "2026-07-02T08:00:00+03:00",
    content: "A quiet little door opens: two months until Dovid and Adina.",
  },
  {
    id: "one-month",
    title: "One Month Glow",
    unlockDate: "2026-08-02T08:00:00+03:00",
    content: "One month left. The countdown starts feeling like music.",
  },
  {
    id: "birthday-22",
    title: "The 22nd",
    unlockDate: "2026-08-22T08:00:00+03:00",
    content: "A birthday box for love, laughter, and the story getting closer.",
  },
  {
    id: "reunion-24",
    title: "Reunion Eve",
    unlockDate: "2026-08-24T12:00:00+03:00",
    content: "Midday opens a memory for the reunion.",
  },
  {
    id: "reunion-25",
    title: "Reunion Day",
    unlockDate: "2026-08-25T12:00:00+03:00",
    content: "A second midday surprise, because some days deserve an echo.",
  },
  ...Array.from({ length: 7 }, (_, index) => {
    const day = 26 + index;

    return {
      id: `final-week-${index + 1}`,
      title: `Final Week: ${7 - index} Days`,
      unlockDate: `2026-08-${String(day).padStart(2, "0")}T08:00:00+03:00`,
      content: `A final-week keepsake before ${COUPLE.weddingDateLabel}.`,
    };
  }),
  {
    id: "wedding-day",
    title: "Wedding Day Vault",
    unlockDate: COUPLE.weddingDate,
    content: "The vault opens. Today the archive becomes a love story.",
  },
];
