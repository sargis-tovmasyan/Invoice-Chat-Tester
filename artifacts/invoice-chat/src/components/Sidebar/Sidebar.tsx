// ─── Sidebar ─────────────────────────────────────────────────────────────────
// Left column: "New Chat" button + the list of in-memory chat sessions.
// Purely a switcher — no persistence, sessions live only in App's state.

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
      {/* Header row */}
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

      {/* New Chat button */}
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto chat-scroll px-2 pb-3 space-y-0.5">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80 hover:bg-accent"
              }`}
              title={session.title}
            >
              {session.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
