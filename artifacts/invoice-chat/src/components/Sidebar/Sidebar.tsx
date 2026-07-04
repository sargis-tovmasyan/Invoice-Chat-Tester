// ─── Sidebar ─────────────────────────────────────────────────────────────────
// Left column: "New Chat" button + the list of chat sessions.

import { useMemo, useState } from "react";
import type { ChatSession } from "../../types";

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  collapsed,
  onToggleCollapsed,
}: {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [renamedTitles, setRenamedTitles] = useState<Record<string, string>>({});
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [showArchived, setShowArchived] = useState(false);

  const visibleSessions = useMemo(
    () => sessions.filter((session) => !removedIds.has(session.id) && !archivedIds.has(session.id)),
    [archivedIds, removedIds, sessions],
  );

  const archivedSessions = useMemo(
    () => sessions.filter((session) => !removedIds.has(session.id) && archivedIds.has(session.id)),
    [archivedIds, removedIds, sessions],
  );

  const displayTitle = (session: ChatSession) => renamedTitles[session.id] ?? session.title;

  const selectFallbackSession = (blockedSessionId: string) => {
    if (blockedSessionId !== activeSessionId) return;

    const fallback = sessions.find(
      (session) => session.id !== blockedSessionId && !removedIds.has(session.id) && !archivedIds.has(session.id),
    );

    if (fallback) {
      onSelectSession(fallback.id);
      return;
    }

    onNewChat();
  };

  const renameSession = (session: ChatSession) => {
    const nextTitle = window.prompt("Rename chat", displayTitle(session));
    if (nextTitle === null) return;

    const normalizedTitle = nextTitle.trim();
    if (!normalizedTitle) return;

    setRenamedTitles((current) => ({ ...current, [session.id]: normalizedTitle }));

    // Keep the in-memory App state aligned until backend chat thread persistence exists.
    session.title = normalizedTitle;
  };

  const archiveSession = (session: ChatSession) => {
    setArchivedIds((current) => new Set(current).add(session.id));
    selectFallbackSession(session.id);
  };

  const restoreSession = (session: ChatSession) => {
    setArchivedIds((current) => {
      const next = new Set(current);
      next.delete(session.id);
      return next;
    });
    onSelectSession(session.id);
  };

  const removeSession = (session: ChatSession) => {
    setRemovedIds((current) => new Set(current).add(session.id));
    selectFallbackSession(session.id);
  };

  if (collapsed) {
    return (
      <div className="hidden sm:flex flex-col items-center w-14 flex-shrink-0 border-r border-border bg-muted/30 py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onNewChat}
          title="New chat"
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex flex-col w-64 flex-shrink-0 border-r border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Chats</span>
        <button
          onClick={onToggleCollapsed}
          title="Collapse sidebar"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent hover:border-primary/30 transition-colors"
        >
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll px-2 pb-3 space-y-1">
        {visibleSessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`group rounded-lg transition-colors ${isActive ? "bg-primary/10" : "hover:bg-accent"}`}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left px-3 pt-2 text-sm truncate ${
                  isActive ? "text-primary font-medium" : "text-foreground/80"
                }`}
                title={displayTitle(session)}
              >
                {displayTitle(session)}
              </button>

              <div className="flex gap-1 px-2 pb-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => renameSession(session)} className="text-[11px] text-muted-foreground hover:text-foreground">Rename</button>
                <button onClick={() => archiveSession(session)} className="text-[11px] text-muted-foreground hover:text-foreground">Archive</button>
                <button onClick={() => removeSession(session)} className="text-[11px] text-destructive hover:underline">Remove</button>
              </div>
            </div>
          );
        })}

        {archivedSessions.length > 0 && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className="w-full px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {showArchived ? "Hide" : "Show"} archived ({archivedSessions.length})
            </button>

            {showArchived && archivedSessions.map((session) => (
              <div key={session.id} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                <button onClick={() => restoreSession(session)} className="block w-full truncate text-left" title={displayTitle(session)}>
                  {displayTitle(session)}
                </button>
                <div className="mt-1 flex gap-2">
                  <button onClick={() => restoreSession(session)} className="text-[11px] hover:text-foreground">Restore</button>
                  <button onClick={() => removeSession(session)} className="text-[11px] text-destructive hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
