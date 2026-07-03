import { useCallback, useMemo, useState } from "react";
import type { ChatMessage, ChatSession } from "./chat.types";

function uid() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

function createDefaultSession(): ChatSession {
  const createdAt = now();
  return {
    id: uid(),
    title: "New chat",
    createdAt,
    updatedAt: createdAt,
    archived: false,
    messages: [],
  };
}

function titleFromMessage(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  return normalized.length > 42 ? `${normalized.slice(0, 42)}…` : normalized;
}

export function createMessage(message: Omit<ChatMessage, "id" | "timestamp"> & Partial<Pick<ChatMessage, "id" | "timestamp">>): ChatMessage {
  return {
    id: message.id ?? uid(),
    timestamp: message.timestamp ?? now(),
    showRaw: message.showRaw ?? false,
    ...message,
  };
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createDefaultSession()]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const activeMessages = activeSession?.messages ?? [];

  const createSession = useCallback(() => {
    const session = createDefaultSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    return session.id;
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const renameSession = useCallback((sessionId: string, title: string) => {
    const nextTitle = title.trim() || "Untitled chat";
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? { ...session, title: nextTitle, updatedAt: now() }
          : session,
      ),
    );
  }, []);

  const archiveSession = useCallback((sessionId: string) => {
    setSessions((current) => {
      const next = current.map((session) =>
        session.id === sessionId ? { ...session, archived: true, updatedAt: now() } : session,
      );

      if (sessionId === activeSessionId) {
        const replacement = next.find((session) => !session.archived && session.id !== sessionId) ?? createDefaultSession();
        if (!next.some((session) => session.id === replacement.id)) next.unshift(replacement);
        setActiveSessionId(replacement.id);
      }

      return next;
    });
  }, [activeSessionId]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      if (remaining.length === 0) {
        const replacement = createDefaultSession();
        setActiveSessionId(replacement.id);
        return [replacement];
      }

      if (sessionId === activeSessionId) {
        const replacement = remaining.find((session) => !session.archived) ?? remaining[0];
        setActiveSessionId(replacement.id);
      }

      return remaining;
    });
  }, [activeSessionId]);

  const addMessage = useCallback((message: Omit<ChatMessage, "id" | "timestamp"> & Partial<Pick<ChatMessage, "id" | "timestamp">>) => {
    const fullMessage = createMessage(message);

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;
        const shouldUseMessageAsTitle = session.messages.length === 0 && session.title === "New chat" && fullMessage.role === "user";
        return {
          ...session,
          title: shouldUseMessageAsTitle ? titleFromMessage(fullMessage.text) : session.title,
          updatedAt: now(),
          messages: [...session.messages, fullMessage],
        };
      }),
    );

    return fullMessage.id;
  }, [activeSessionId]);

  const clearActiveSession = useCallback(() => {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages: [], updatedAt: now() }
          : session,
      ),
    );
  }, [activeSessionId]);

  const toggleRaw = useCallback((messageId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              messages: session.messages.map((message) =>
                message.id === messageId ? { ...message, showRaw: !message.showRaw } : message,
              ),
            }
          : session,
      ),
    );
  }, [activeSessionId]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    activeMessages,
    createSession,
    selectSession,
    renameSession,
    archiveSession,
    deleteSession,
    addMessage,
    clearActiveSession,
    toggleRaw,
  };
}
