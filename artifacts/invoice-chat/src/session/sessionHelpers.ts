// ─── Chat session helpers ───────────────────────────────────────────────────
// Sessions are the sidebar's "chats". New chats start locally, then attach to
// backend chat threads after the first successful /ai/chat response.

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
