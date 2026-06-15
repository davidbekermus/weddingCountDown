import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Resend } from "resend";

initializeApp();

const db = getFirestore();
const resendApiKey = defineSecret("RESEND_API_KEY");

const allowedEmails = ["davidbekermus@gmail.com", "adina.segel1@gmail.com"] as const;
const weddingDate = new Date("2026-09-02T18:00:00+03:00");
const timeZone = "Asia/Jerusalem";

const partnerByEmail: Record<string, string> = {
  "davidbekermus@gmail.com": "adina.segel1@gmail.com",
  "adina.segel1@gmail.com": "davidbekermus@gmail.com",
};

const systemBoxes = [
  ["two-months", "Two Months To Forever", "2026-07-02T08:00:00+03:00"],
  ["one-month", "One Month Glow", "2026-08-02T08:00:00+03:00"],
  ["birthday-22", "The 22nd", "2026-08-22T08:00:00+03:00"],
  ["reunion-24", "Reunion Eve", "2026-08-24T12:00:00+03:00"],
  ["reunion-25", "Reunion Day", "2026-08-25T12:00:00+03:00"],
  ["final-week-1", "Final Week: 7 Days", "2026-08-26T08:00:00+03:00"],
  ["final-week-2", "Final Week: 6 Days", "2026-08-27T08:00:00+03:00"],
  ["final-week-3", "Final Week: 5 Days", "2026-08-28T08:00:00+03:00"],
  ["final-week-4", "Final Week: 4 Days", "2026-08-29T08:00:00+03:00"],
  ["final-week-5", "Final Week: 3 Days", "2026-08-30T08:00:00+03:00"],
  ["final-week-6", "Final Week: 2 Days", "2026-08-31T08:00:00+03:00"],
  ["final-week-7", "Final Week: 1 Day", "2026-09-01T08:00:00+03:00"],
  ["wedding-day", "Wedding Day Vault", "2026-09-02T18:00:00+03:00"],
] as const;

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function countdownSnapshot(now = new Date()) {
  const delta = Math.max(weddingDate.getTime() - now.getTime(), 0);
  return {
    days: Math.floor(delta / 86_400_000),
    hours: Math.floor((delta / 3_600_000) % 24),
    minutes: Math.floor((delta / 60_000) % 60),
    seconds: Math.floor((delta / 1_000) % 60),
  };
}

function emailHtml(args: {
  recipientEmail: string;
  partnerEmail: string;
  message?: FirebaseFirestore.DocumentData;
}) {
  const countdown = countdownSnapshot();
  const message = args.message;

  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #2d173b; background: #fbf7ff; padding: 32px;">
      <div style="max-width: 620px; margin: 0 auto; background: rgba(255,255,255,.78); border: 1px solid #e9d5ff; border-radius: 24px; padding: 28px;">
        <p style="color:#5b2f8f; text-transform:uppercase; letter-spacing:.14em; font-weight:700;">Dovid & Adina</p>
        <h1 style="font-family: Georgia, serif; font-size: 42px; line-height: 1; margin: 0 0 18px;">${countdown.days} days, ${countdown.hours} hours</h1>
        <p style="color:#7b6688;">Countdown snapshot: ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s until September 2.</p>
        <hr style="border:0; border-top:1px solid #e9d5ff; margin: 24px 0;" />
        <p style="color:#5b2f8f; font-weight:700;">From ${args.partnerEmail}</p>
        ${
          message
            ? `<h2 style="font-family: Georgia, serif;">${message.type}</h2>
               <p style="font-size:18px; line-height:1.7;">${message.content}</p>
               ${message.mediaUrl ? `<p><a href="${message.mediaUrl}">Open attached memory</a></p>` : ""}`
            : `<p style="font-size:18px; line-height:1.7;">No message was created for today yet.</p>`
        }
      </div>
    </div>
  `;
}

export const seedSystemSurpriseBoxes = onSchedule(
  { schedule: "0 3 * * *", timeZone },
  async () => {
    const batch = db.batch();

    for (const [id, title, iso] of systemBoxes) {
      batch.set(
        db.collection("surpriseBoxes").doc(`system-${id}`),
        {
          ownerId: "system",
          ownerEmail: "system",
          kind: "system",
          title,
          content: "A system-generated wedding surprise.",
          unlockDate: Timestamp.fromDate(new Date(iso)),
          lockedStatus: new Date(iso).getTime() > Date.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    }

    await batch.commit();
    logger.info("System surprise boxes seeded.");
  },
);

export const unlockSurpriseBoxes = onSchedule(
  { schedule: "every 15 minutes", timeZone },
  async () => {
    const snapshot = await db
      .collection("surpriseBoxes")
      .where("lockedStatus", "==", true)
      .where("unlockDate", "<=", Timestamp.now())
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((item) => {
      batch.update(item.ref, { lockedStatus: false, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    logger.info(`Unlocked ${snapshot.size} surprise boxes.`);
  },
);

export const sendDailyWeddingEmails = onSchedule(
  { schedule: "0 8 * * *", timeZone, secrets: [resendApiKey] },
  async () => {
    if (Date.now() >= weddingDate.getTime()) {
      logger.info("Wedding date reached; daily pre-wedding emails stopped.");
      return;
    }

    const resend = new Resend(resendApiKey.value());
    const today = dateKey();

    for (const recipientEmail of allowedEmails) {
      const partnerEmail = partnerByEmail[recipientEmail];
      const messageSnapshot = await db
        .collection("dailyMessages")
        .where("ownerEmail", "==", partnerEmail)
        .where("recipientEmail", "==", recipientEmail)
        .where("dateKey", "==", today)
        .limit(1)
        .get();

      const messageDoc = messageSnapshot.docs[0];

      await resend.emails.send({
        from: "Wedding Vault <onboarding@resend.dev>",
        to: recipientEmail,
        subject: `Today's wedding message for ${today}`,
        html: emailHtml({
          recipientEmail,
          partnerEmail,
          message: messageDoc?.data(),
        }),
      });

      if (messageDoc) {
        await messageDoc.ref.update({
          lockedStatus: true,
          emailSentAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
    }

    logger.info("Daily wedding emails sent.");
  },
);

export const createWeddingDaySlideshowManifest = onSchedule(
  { schedule: "0 18 2 9 *", timeZone },
  async () => {
    const [messages, media, boxes] = await Promise.all([
      db.collection("dailyMessages").orderBy("dateKey", "asc").get(),
      db.collection("mediaLibrary").orderBy("createdAt", "asc").get(),
      db.collection("surpriseBoxes").orderBy("unlockDate", "asc").get(),
    ]);

    await db.collection("slideshowManifests").doc("wedding-day").set({
      generatedAt: Timestamp.now(),
      mode: "auto-generated",
      title: "Dovid & Adina: September 2",
      items: [
        ...messages.docs.map((item) => ({ source: "dailyMessages", id: item.id, ...item.data() })),
        ...media.docs.map((item) => ({ source: "mediaLibrary", id: item.id, ...item.data() })),
        ...boxes.docs.map((item) => ({ source: "surpriseBoxes", id: item.id, ...item.data() })),
      ],
      exportStatus: "manifest-ready",
    });

    logger.info("Wedding day slideshow manifest created.");
  },
);
