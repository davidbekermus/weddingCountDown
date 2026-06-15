"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ActionCodeSettings,
  GoogleAuthProvider,
  User,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";
import {
  ALLOWED_EMAILS,
  COUPLE,
  MESSAGE_TYPES,
  PARTNER_BY_EMAIL,
  isAllowedEmail,
} from "@/lib/constants";
import { canEditTodayMessage, getDateKey, toCountdownParts } from "@/lib/date";
import { SYSTEM_SURPRISES } from "@/lib/surprise-schedule";
import type { DailyMessage, MediaItem, MessageType, SurpriseBox } from "@/lib/types";

type AuthStatus = "checking" | "signed-out" | "blocked" | "signed-in";

const mediaAccept = "image/*,video/*,audio/*";

function getMediaKind(file: File): "image" | "video" | "voice" {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "image";
}

function timestampToDate(value?: { seconds: number }) {
  return value ? new Date(value.seconds * 1000) : null;
}

function toDateTimeInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatTimeUntil(targetTime: number, now: number) {
  const delta = Math.max(targetTime - now, 0);
  const days = Math.floor(delta / 86_400_000);
  const hours = Math.floor((delta / 3_600_000) % 24);
  const minutes = Math.floor((delta / 60_000) % 60);

  if (days > 0) return `${days} day${days === 1 ? "" : "s"} and ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} and ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function Countdown() {
  const [parts, setParts] = useState(() => toCountdownParts(COUPLE.weddingDate));

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(toCountdownParts(COUPLE.weddingDate));
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="hero-panel" aria-label="Wedding countdown">
      <div className="hero-content">
        <p className="eyebrow">Dovid and Adina</p>
        <h1>September 2</h1>
        <div className="countdown-grid">
          {Object.entries(parts).map(([label, value]) => (
            <div className="countdown-cell" key={label}>
              <strong>{String(value).padStart(2, "0")}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="hero-copy">
          A private little world for the notes, voices, pictures, and surprises
          becoming part of the wedding story.
        </p>
      </div>
    </section>
  );
}

function LoginCard() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  async function signInWithGoogle() {
    try {
      setIsGoogleSigningIn(true);
      setStatus("Opening Google sign-in...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        login_hint: "davidbekermus@gmail.com",
      });
      const result = await signInWithPopup(auth, provider);

      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth);
        setStatus("This Google account is not allowed into this private app.");
        return;
      }

      setStatus("Signed in with Google.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google sign-in did not complete.";
      setStatus(message);
    } finally {
      setIsGoogleSigningIn(false);
    }
  }

  async function sendLink() {
    const normalized = email.trim().toLowerCase();

    if (!isAllowedEmail(normalized)) {
      setStatus("This app is private for Dovid and Adina only.");
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const actionCodeSettings: ActionCodeSettings = {
      url: appUrl,
      handleCodeInApp: true,
    };

    try {
      setIsSending(true);
      setStatus("Sending magic link...");
      await sendSignInLinkToEmail(auth, normalized, actionCodeSettings);
      window.localStorage.setItem("weddingSignInEmail", normalized);
      setStatus(
        "Magic link sent by Firebase Auth. Check Inbox, Spam, Promotions, and Updates.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Firebase could not send the link.";
      setStatus(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">Private wedding vault</p>
        <h1>Dovid & Adina</h1>
        <p>
          Continue with Google, or use an email magic link as a fallback. Only
          the two whitelisted addresses can unlock this space.
        </p>
        <div className="preferred-auth">
          <span className="auth-pill">Fastest way in</span>
          <button
            className="google-button"
            onClick={signInWithGoogle}
            disabled={isGoogleSigningIn || isSending}
          >
            <span className="google-mark" aria-hidden="true">
              G
            </span>
            <span>
              <strong>
                {isGoogleSigningIn ? "Opening Google..." : "Continue with Google"}
              </strong>
              <small>Use one of the two private Gmail accounts</small>
            </span>
          </button>
        </div>
        <div className="auth-divider">
          <span>magic link fallback</span>
        </div>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
          />
        </label>
        <button
          className="primary-button"
          onClick={sendLink}
          disabled={isSending || isGoogleSigningIn}
        >
          {isSending ? "Sending..." : "Send magic link"}
        </button>
        {status ? <p className="form-status">{status}</p> : null}
      </div>
    </main>
  );
}

function DailyMessageComposer({ user }: { user: User }) {
  const todayKey = getDateKey();
  const [message, setMessage] = useState<DailyMessage | null>(null);
  const [type, setType] = useState<MessageType>("Nice note");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSentPopup, setShowSentPopup] = useState(false);
  const canEdit = canEditTodayMessage() && !message?.lockedStatus;
  const partnerEmail =
    PARTNER_BY_EMAIL[user.email?.toLowerCase() as keyof typeof PARTNER_BY_EMAIL];

  useEffect(() => {
    const ref = doc(db, "dailyMessages", `${user.uid}_${todayKey}`);
    return onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        setMessage(null);
        setContent("");
        return;
      }

      const data = { id: snapshot.id, ...snapshot.data() } as DailyMessage;
      setMessage(data);
      setType(data.type);
      setContent(data.content);
      setMediaUrl(data.mediaUrl ?? "");
    });
  }, [todayKey, user.uid]);

  async function saveMessage() {
    if (!partnerEmail || !canEdit || isSaving) return;

    try {
      setIsSaving(true);
      await setDoc(
        doc(db, "dailyMessages", `${user.uid}_${todayKey}`),
        {
          ownerId: user.uid,
          ownerEmail: user.email,
          recipientEmail: partnerEmail,
          dateKey: todayKey,
          type,
          content,
          mediaUrl: mediaUrl || null,
          lockedStatus: false,
          updatedAt: serverTimestamp(),
          createdAt: message?.createdAt ?? serverTimestamp(),
        },
        { merge: true },
      );
      setShowSentPopup(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="glass-card composer">
      <div>
        <p className="eyebrow">Daily message</p>
        <h2>One message for today</h2>
        <p>
          Editable until 08:00 Jerusalem time. After the email sends, it locks.
        </p>
      </div>
      <select
        value={type}
        onChange={(event) => setType(event.target.value as MessageType)}
        disabled={!canEdit}
      >
        {MESSAGE_TYPES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={!canEdit}
        placeholder="Write the thing only they should receive..."
      />
      <input
        value={mediaUrl}
        onChange={(event) => setMediaUrl(event.target.value)}
        disabled={!canEdit}
        placeholder="Optional media URL from the library"
      />
      <button
        className="secondary-button"
        onClick={saveMessage}
        disabled={!canEdit || isSaving}
      >
        {isSaving ? (
          "Saving..."
        ) : message ? (
          <>Update today&apos;s message</>
        ) : (
          <>Save today&apos;s message</>
        )}
      </button>
      {!canEdit ? <p className="form-status">Today&apos;s message is locked.</p> : null}
      {showSentPopup ? (
        <div className="sent-popup-backdrop" role="presentation">
          <div
            className="sent-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sent-popup-title"
          >
            <span className="sent-popup-glow" aria-hidden="true" />
            <p className="eyebrow">Saved for today</p>
            <h3 id="sent-popup-title">Your message is tucked away.</h3>
            <p>
              It has been saved for your partner. If it is before 08:00, you can
              still edit it until the daily email locks it.
            </p>
            <button
              className="primary-button"
              onClick={() => setShowSentPopup(false)}
            >
              Beautiful
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TodaysPartnerMessage({ user }: { user: User }) {
  const todayKey = getDateKey();
  const [message, setMessage] = useState<DailyMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user.email) return;

    const q = query(
      collection(db, "dailyMessages"),
      where("recipientEmail", "==", user.email.toLowerCase()),
      where("dateKey", "==", todayKey),
      limit(1),
    );

    return onSnapshot(q, (snapshot) => {
      const item = snapshot.docs[0];
      setMessage(item ? ({ id: item.id, ...item.data() } as DailyMessage) : null);
      setIsLoading(false);
    });
  }, [todayKey, user.email]);

  return (
    <section className="glass-card partner-message-card">
      <p className="eyebrow">Today&apos;s message for you</p>
      {isLoading ? (
        <p>Looking for today&apos;s note...</p>
      ) : message ? (
        <>
          <span className="message-type-pill">{message.type}</span>
          <h2>A little something arrived.</h2>
          <p className="partner-message-content">{message.content}</p>
          {message.mediaUrl ? (
            <a className="inline-memory-link" href={message.mediaUrl} target="_blank">
              Open attached memory
            </a>
          ) : null}
        </>
      ) : (
        <>
          <h2>Nothing here yet.</h2>
          <p>
            When your partner saves today&apos;s message for you, it will appear
            here in the app too.
          </p>
        </>
      )}
    </section>
  );
}

function MediaLibrary({
  user,
  variant = "card",
}: {
  user: User;
  variant?: "card" | "page";
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, "mediaLibrary"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaItem));
    });
  }, []);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    const kind = getMediaKind(file);
    const storagePath = `mediaLibrary/${user.uid}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const mediaUrl = await getDownloadURL(storageRef);
    await addDoc(collection(db, "mediaLibrary"), {
      ownerId: user.uid,
      ownerEmail: user.email,
      type: kind,
      title: file.name,
      storagePath,
      mediaUrl,
      usedFor: ["homepage", "slideshow", "vault"],
      lockedStatus: false,
      createdAt: serverTimestamp(),
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(item: MediaItem) {
    if (item.ownerId !== user.uid || !item.id) return;
    await deleteDoc(doc(db, "mediaLibrary", item.id));
    await deleteObject(ref(storage, item.storagePath)).catch(() => undefined);
  }

  function toggleSelected(item: MediaItem) {
    if (!item.id || item.ownerId !== user.uid) return;
    const itemId = item.id;

    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  function toggleEditMode() {
    setIsEditing((current) => !current);
    setSelectedIds([]);
  }

  function selectAllOwnMedia() {
    const ownIds = items
      .filter((item) => item.ownerId === user.uid && item.id)
      .map((item) => item.id as string);

    setSelectedIds((current) =>
      current.length === ownIds.length ? [] : ownIds,
    );
  }

  async function deleteSelected() {
    const selectedItems = items.filter((item) => item.id && selectedIds.includes(item.id));

    await Promise.all(selectedItems.map((item) => deleteItem(item)));
    setSelectedIds([]);
    setIsEditing(false);
  }

  return (
    <section
      className={
        variant === "page"
          ? "glass-card media-library-card gallery-page-card"
          : "glass-card media-library-card"
      }
    >
      <div className={variant === "page" ? "gallery-page-heading" : "section-heading"}>
        <div>
          <p className="eyebrow">Shared media</p>
          <h2>{variant === "page" ? "The Memory Library" : "Memory library"}</h2>
          <p className="gallery-subtitle">
            {variant === "page"
              ? `${items.length} photos, videos, and voice notes saved for the countdown, surprises, and wedding vault.`
              : `${items.length} memories saved for the countdown, surprises, and vault.`}
          </p>
        </div>
        <div className="gallery-actions">
          {isEditing ? (
            <>
              <button className="ghost-button" onClick={selectAllOwnMedia}>
                {selectedIds.length ? "Clear" : "Select mine"}
              </button>
              <button
                className="danger-button"
                onClick={deleteSelected}
                disabled={selectedIds.length === 0}
              >
                Delete {selectedIds.length ? `(${selectedIds.length})` : ""}
              </button>
            </>
          ) : null}
          <button className="ghost-button" onClick={toggleEditMode}>
            {isEditing ? "Done" : "Edit"}
          </button>
          <label className="upload-button">
            {uploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              accept={mediaAccept}
              multiple
              onChange={(event) => uploadFiles(event.target.files)}
            />
          </label>
        </div>
      </div>
      {isEditing ? (
        <div className="edit-mode-bar">
          <span>{selectedIds.length} selected</span>
          <span>Tap your memories to select them.</span>
        </div>
      ) : null}
      {items.length ? (
        <div className={isEditing ? "media-grid is-editing" : "media-grid"}>
          {items.map((item) => {
            const isOwn = item.ownerId === user.uid;
            const isSelected = item.id ? selectedIds.includes(item.id) : false;

            return (
              <article
                className={[
                  "media-tile",
                  isEditing ? "is-selectable" : "",
                  isSelected ? "is-selected" : "",
                  !isOwn && isEditing ? "is-disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={item.id}
              >
                <button
                  className="media-select-target"
                  disabled={!isEditing || !isOwn}
                  onClick={() => toggleSelected(item)}
                  aria-label={`Select ${item.title ?? item.type}`}
                  aria-pressed={isSelected}
                >
                  {item.type === "image" ? (
                    <img src={item.mediaUrl} alt={item.title ?? "Shared memory"} />
                  ) : item.type === "video" ? (
                    <video src={item.mediaUrl} controls={!isEditing} muted={isEditing} />
                  ) : (
                    <div className="audio-tile">
                      <span>Voice</span>
                      <strong>{item.title ?? "Audio memory"}</strong>
                      {!isEditing ? <audio src={item.mediaUrl} controls /> : null}
                    </div>
                  )}
                  <span className="media-gradient" />
                  <span className="media-type-badge">{item.type}</span>
                  {isEditing ? (
                    <span className="selection-check" aria-hidden="true">
                      {isSelected ? "✓" : ""}
                    </span>
                  ) : null}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-gallery">
          <p className="eyebrow">No memories yet</p>
          <h3>Start the gallery with a favorite photo, video, or voice note.</h3>
        </div>
      )}
    </section>
  );
}

function SurpriseBoxes({ user }: { user: User }) {
  const [boxes, setBoxes] = useState<SurpriseBox[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const q = query(collection(db, "surpriseBoxes"), orderBy("unlockDate", "asc"));
    return onSnapshot(q, (snapshot) => {
      setBoxes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SurpriseBox));
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function resetBoxForm() {
    setTitle("");
    setContent("");
    setUnlockDate("");
    setEditingBoxId(null);
    setActiveTemplateId(null);
  }

  function startTemplate(template: (typeof SYSTEM_SURPRISES)[number]) {
    const existing = boxes.find(
      (box) => box.ownerId === user.uid && box.templateId === template.id,
    );

    if (existing) {
      startEditBox(existing);
      return;
    }

    setTitle(template.title);
    setContent(template.content);
    setUnlockDate(toDateTimeInputValue(new Date(template.unlockDate)));
    setEditingBoxId(null);
    setActiveTemplateId(template.id);
  }

  function startEditBox(box: SurpriseBox) {
    const unlock = timestampToDate(box.unlockDate);

    if (box.ownerId !== user.uid || !box.id || !unlock || unlock.getTime() <= now) return;

    setTitle(box.title);
    setContent(box.content);
    setUnlockDate(toDateTimeInputValue(unlock));
    setEditingBoxId(box.id);
    setActiveTemplateId(box.templateId ?? null);
  }

  async function saveBox() {
    if (!title || !unlockDate) return;

    const payload = {
      ownerId: user.uid,
      ownerEmail: user.email,
      kind: "custom",
      title,
      content,
      unlockDate: Timestamp.fromDate(new Date(unlockDate)),
      lockedStatus: new Date(unlockDate).getTime() > Date.now(),
      templateId: activeTemplateId,
      updatedAt: serverTimestamp(),
    };

    if (editingBoxId) {
      await updateDoc(doc(db, "surpriseBoxes", editingBoxId), payload);
    } else {
      await addDoc(collection(db, "surpriseBoxes"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    resetBoxForm();
  }

  const customBoxes = boxes.filter((box) => box.ownerId !== "system");

  return (
    <section className="glass-card surprise-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Surprises</p>
          <h2>Unlock boxes</h2>
          <p>
            Default boxes are starter templates. Create your own version, then
            edit it until unlock time.
          </p>
        </div>
      </div>
      <div className="surprise-layout">
        <div className="surprise-composer">
          <p className="eyebrow">
            {editingBoxId ? "Editing box" : activeTemplateId ? "Template selected" : "Create a box"}
          </p>
          <div className="box-form">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Box title" />
            <input
              value={unlockDate}
              onChange={(event) => setUnlockDate(event.target.value)}
              type="datetime-local"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Text, clue, memory, or instruction"
            />
            <div className="box-form-actions">
              <button className="secondary-button" onClick={saveBox}>
                {editingBoxId ? "Save changes" : activeTemplateId ? "Create from template" : "Create custom box"}
              </button>
              {(editingBoxId || activeTemplateId || title || content || unlockDate) ? (
                <button className="ghost-button" onClick={resetBoxForm}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="surprise-board">
          <div>
            <h3>Default moments</h3>
            <div className="box-list template-list">
              {SYSTEM_SURPRISES.map((box) => {
                const existing = boxes.find(
                  (item) => item.ownerId === user.uid && item.templateId === box.id,
                );
                const unlockTime = new Date(box.unlockDate).getTime();
                const editable = unlockTime > now;

                return (
                  <article className="box-template" key={box.id}>
                    <span>Starter moment</span>
                    <strong>{box.title}</strong>
                    <time>{new Date(box.unlockDate).toLocaleString()}</time>
                    <p>
                      {existing
                        ? "Your editable version exists."
                        : "Create your own version from this default."}
                    </p>
                    <button
                      className="ghost-button"
                      onClick={() => startTemplate(box)}
                      disabled={!editable}
                    >
                      {existing ? "Edit yours" : "Create yours"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div>
            <h3>Your created boxes</h3>
            <div className="box-list custom-list">
              {customBoxes.length > 0 ? (
                customBoxes.map((box) => {
                  const unlock = timestampToDate(box.unlockDate);
                  const locked = unlock ? unlock.getTime() > now : box.lockedStatus;
                  const canEdit = box.ownerId === user.uid && locked;

                  return (
                    <article key={box.id}>
                      <span>{box.templateId ? "Your default box" : box.kind}</span>
                      <strong>{box.title}</strong>
                      <time>{unlock?.toLocaleString()}</time>
                      <p>{locked ? "Locked until its moment" : box.content}</p>
                      {canEdit ? (
                        <button className="ghost-button" onClick={() => startEditBox(box)}>
                          Edit
                        </button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <article className="empty-box-state">
                  <span>Nothing created yet</span>
                  <strong>Choose a default moment or make your own.</strong>
                </article>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TodaySurprise() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const unlocked = SYSTEM_SURPRISES.filter(
    (box) => new Date(box.unlockDate).getTime() <= now,
  ).at(-1);
  const nextSurprise = SYSTEM_SURPRISES.find(
    (box) => new Date(box.unlockDate).getTime() > now,
  );
  const nextDate = nextSurprise ? new Date(nextSurprise.unlockDate) : null;

  return (
    <section className="glass-card accent-card">
      <p className="eyebrow">Today&apos;s surprise</p>
      <h2>{unlocked ? unlocked.title : "Nothing unlocked yet"}</h2>
      <p>{unlocked?.content ?? "The next little door is waiting for its time."}</p>
      {nextSurprise && nextDate ? (
        <div className="next-surprise">
          <span>Next surprise</span>
          <strong>{nextSurprise.title}</strong>
          <time dateTime={nextSurprise.unlockDate}>
            {nextDate.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
          <p>Coming in {formatTimeUntil(nextDate.getTime(), now)}.</p>
        </div>
      ) : (
        <div className="next-surprise">
          <span>Next surprise</span>
          <strong>The wedding day vault is open.</strong>
        </div>
      )}
    </section>
  );
}

function RandomMemory({ items }: { items: MediaItem[] }) {
  const [memoryIndex, setMemoryIndex] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;

    const chooseMemory = () => {
      setMemoryIndex(Math.floor(Math.random() * items.length));
    };

    const initial = window.setTimeout(chooseMemory, 0);
    const interval = window.setInterval(chooseMemory, 45_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [items.length]);

  const memory =
    items.length > 0 ? items[memoryIndex % items.length] : null;

  return (
    <section className="glass-card memory-viewer">
      <p className="eyebrow">Random memory</p>
      {memory ? (
        <>
          {memory.type === "image" ? (
            <img src={memory.mediaUrl} alt={memory.title ?? "Random memory"} />
          ) : memory.type === "video" ? (
            <video src={memory.mediaUrl} controls />
          ) : (
            <audio src={memory.mediaUrl} controls />
          )}
          <p>{memory.title}</p>
        </>
      ) : (
        <p>Upload a first memory and this panel will start glowing.</p>
      )}
    </section>
  );
}

function VaultAndSlideshow() {
  const [now, setNow] = useState(() => Date.now());
  const weddingOpen = new Date(COUPLE.weddingDate).getTime() <= now;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="glass-card vault-card">
      <p className="eyebrow">Wedding vault</p>
      <h2>{weddingOpen ? "Cinematic slideshow unlocked" : "Locked until September 2"}</h2>
      <p>
        The vault gathers daily messages, shared media, surprise boxes, notes,
        and voice messages into the wedding-day story.
      </p>
      <div className="slideshow-stage">
        <span>Auto slideshow</span>
        <span>Curated order</span>
        <span>MP4 export queue</span>
      </div>
    </section>
  );
}

function GalleryInvite() {
  return (
    <section className="gallery-invite">
      <div>
        <p className="eyebrow">Shared media</p>
        <h2>Memory Library</h2>
        <p>
          Browse the full private gallery, upload new memories, and use edit mode
          to select photos and videos.
        </p>
      </div>
      <Link className="gallery-link-card" href="/gallery">
        Open gallery
      </Link>
    </section>
  );
}

function Dashboard({ user }: { user: User }) {
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "mediaLibrary"),
      where("usedFor", "array-contains", "homepage"),
      orderBy("createdAt", "desc"),
      limit(30),
    );

    return onSnapshot(q, (snapshot) => {
      setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaItem));
    });
  }, []);

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/">D & A</Link>
        <div>
          <Link href="/gallery">Gallery</Link>
          <span>{user.email}</span>
          <button onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </nav>
      <Countdown />
      <section className="home-section">
        <div className="home-section-heading">
          <p className="eyebrow">Live moments</p>
          <h2>What is blooming today</h2>
        </div>
        <div className="dashboard-grid spotlight-grid">
          <RandomMemory items={media} />
          <TodaySurprise />
        </div>
      </section>
      <section className="home-section">
        <div className="home-section-heading">
          <p className="eyebrow">Daily love notes</p>
          <h2>Write one, receive one</h2>
        </div>
        <div className="feature-grid message-grid">
          <DailyMessageComposer user={user} />
          <TodaysPartnerMessage user={user} />
        </div>
      </section>
      <section className="home-section story-section">
        <div className="home-section-heading">
          <p className="eyebrow">The story archive</p>
          <h2>Build the wedding story</h2>
        </div>
        <div className="story-flow">
          <GalleryInvite />
          <SurpriseBoxes user={user} />
          <VaultAndSlideshow />
        </div>
      </section>
    </main>
  );
}

function GalleryPageView({ user }: { user: User }) {
  return (
    <main className="app-shell gallery-page-shell">
      <nav className="top-nav">
        <Link href="/">D & A</Link>
        <div>
          <Link href="/">Home</Link>
          <span>{user.email}</span>
          <button onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </nav>
      <section className="gallery-hero">
        <div>
          <p className="eyebrow">Private gallery</p>
          <h1>Every little memory, saved beautifully.</h1>
          <p>
            A romantic Instagram-style library for photos, videos, and voice
            notes. Upload together, browse softly, and switch into edit mode when
            you want to select or remove your own media.
          </p>
        </div>
        <div className="gallery-hero-stat">
          <span>Sept 2</span>
          <strong>D & A</strong>
        </div>
      </section>
      <MediaLibrary user={user} variant="page" />
    </main>
  );
}

export default function WeddingApp({
  view = "home",
}: {
  view?: "home" | "gallery";
}) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function completeEmailLink() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;
      const stored = window.localStorage.getItem("weddingSignInEmail");
      const email = stored ?? window.prompt("Confirm your email address") ?? "";

      if (!isAllowedEmail(email)) {
        setStatus("blocked");
        return;
      }

      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem("weddingSignInEmail");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    void completeEmailLink();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setStatus("signed-out");
        return;
      }

      if (!isAllowedEmail(nextUser.email)) {
        await signOut(auth);
        setUser(null);
        setStatus("blocked");
        return;
      }

      await setDoc(
        doc(db, "users", nextUser.uid),
        {
          email: nextUser.email,
          displayName: nextUser.displayName ?? nextUser.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setUser(nextUser);
      setStatus("signed-in");
    });
  }, []);

  if (status === "checking") {
    return <main className="loading-screen">Opening the vault...</main>;
  }

  if (status === "blocked") {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <p className="eyebrow">Private</p>
          <h1>Access blocked</h1>
          <p>Only {ALLOWED_EMAILS.join(" and ")} can enter this wedding app.</p>
        </div>
      </main>
    );
  }

  if (!user) return <LoginCard />;

  return view === "gallery" ? (
    <GalleryPageView user={user} />
  ) : (
    <Dashboard user={user} />
  );
}
