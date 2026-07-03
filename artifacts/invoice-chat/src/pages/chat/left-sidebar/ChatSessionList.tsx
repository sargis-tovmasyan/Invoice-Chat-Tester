import type { ChatSession } from "../chat.types";
import { ChatSessionItem } from "./ChatSessionItem";

interface ChatSessionListProps {
  title: string;
  emptyText: string;
  sessions: ChatSession[];
  activeSessionId: string;
  archived?: boolean;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onRemoveSession: (sessionId: string) => void;
}

export function ChatSessionList({ title, emptyText, sessions, activeSessionId, archived = false, onSelectSession, onRenameSession, onArchiveSession, onRemoveSession }: ChatSessionListProps) {
  return (
    <section>
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((session) => (
            <ChatSessionItem
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              archived={archived}
              onSelect={() => onSelectSession(session.id)}
              onRename={() => {
                const nextTitle = window.prompt("Rename chat", session.title);
                if (nextTitle !== null) onRenameSession(session.id, nextTitle);
              }}
              onArchive={() => onArchiveSession(session.id)}
              onRemove={() => onRemoveSession(session.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
