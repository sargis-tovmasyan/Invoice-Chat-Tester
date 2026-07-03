import type { ChatSession } from "../chat.types";
import { ChatSessionList } from "./ChatSessionList";
import { NewChatButton } from "./NewChatButton";

interface LeftSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function LeftSidebar(props: LeftSidebarProps) {
  const activeSessions = props.sessions.filter((session) => !session.archived);
  const archivedSessions = props.sessions.filter((session) => session.archived);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur md:flex">
      <div className="border-b border-border p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">AI</div>
          <div>
            <div className="text-sm font-semibold">Invoice Chat</div>
            <div className="text-xs text-muted-foreground">Document assistant</div>
          </div>
        </div>
        <NewChatButton onClick={props.onNewChat} />
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <ChatSessionList title="Chats" emptyText="No active chats" sessions={activeSessions} activeSessionId={props.activeSessionId} onSelectSession={props.onSelectSession} onRenameSession={props.onRenameSession} onArchiveSession={props.onArchiveSession} onDeleteSession={props.onDeleteSession} />
        {archivedSessions.length > 0 && (
          <div className="mt-6">
            <ChatSessionList title="Archived" emptyText="No archived chats" sessions={archivedSessions} activeSessionId={props.activeSessionId} archived onSelectSession={props.onSelectSession} onRenameSession={props.onRenameSession} onArchiveSession={props.onArchiveSession} onDeleteSession={props.onDeleteSession} />
          </div>
        )}
      </div>
    </aside>
  );
}
