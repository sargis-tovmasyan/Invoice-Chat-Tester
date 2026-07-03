// ─── Chat session helpers ───────────────────────────────────────────────────
// Sessions are the sidebar's "chats". They live only in React state (no
// localStorage, no backend) — refreshing the page starts over, on purpose.

import { uid } from "../lib/helpers";
import type { ChatSession } from "../types";

export function createEmptySession(): ChatSession {
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    pendingForm: null,
    createdAt: Date.now(),
  };
}
