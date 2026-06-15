import type { MESSAGE_TYPES } from "./constants";

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type MediaKind = "image" | "video" | "voice";

export type SurpriseBoxKind = "system" | "custom";

export type VaultItemKind =
  | "dailyMessage"
  | "media"
  | "surpriseBox"
  | "note"
  | "voice";

export type FirestoreTimestampLike = {
  seconds: number;
  nanoseconds: number;
};

export type DailyMessage = {
  id?: string;
  ownerId: string;
  ownerEmail: string;
  recipientId?: string;
  recipientEmail: string;
  dateKey: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaKind?: MediaKind;
  lockedStatus: boolean;
  emailSentAt?: FirestoreTimestampLike;
  createdAt?: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

export type MediaItem = {
  id?: string;
  ownerId: string;
  ownerEmail: string;
  type: MediaKind;
  title?: string;
  storagePath: string;
  mediaUrl: string;
  usedFor?: string[];
  lockedStatus: boolean;
  createdAt?: FirestoreTimestampLike;
};

export type SurpriseBox = {
  id?: string;
  ownerId: string;
  ownerEmail: string;
  recipientId?: string;
  recipientEmail?: string;
  kind: SurpriseBoxKind;
  title: string;
  content: string;
  mediaUrl?: string;
  voiceUrl?: string;
  templateId?: string;
  unlockDate: FirestoreTimestampLike;
  lockedStatus: boolean;
  createdAt?: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

export type VaultItem = {
  id?: string;
  ownerId: string;
  recipientId?: string;
  type: VaultItemKind;
  content?: string;
  mediaUrl?: string;
  unlockDate?: FirestoreTimestampLike;
  lockedStatus: boolean;
  sourceCollection?: string;
  sourceId?: string;
  createdAt?: FirestoreTimestampLike;
};
