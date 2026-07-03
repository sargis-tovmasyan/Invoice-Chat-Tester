import { useState } from "react";
import { ChatComposer } from "./pages/chat/composer/ChatComposer";
import { ConversationPanel } from "./pages/chat/conversation/ConversationPanel";
import { LeftSidebar } from "./pages/chat/left-sidebar/LeftSidebar";
import { useChatActions } from "./pages/chat/useChatActions";
import { useChatSessions } from "./pages/chat/useChatSessions";

export default function App() {
  const [input, setInput] = useState("");
  const sessions = useChatSessions();
  const actions = useChatActions(sessions, input, setInput);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <LeftSidebar sessions={sessions.sessions} activeSessionId={sessions.activeSessionId} onNewChat={sessions.createSession} onSelectSession={sessions.selectSession} onRenameSession={sessions.renameSession} onArchiveSession={sessions.archiveSession} onRemoveSession={sessions.removeSession} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{sessions.activeSession?.title ?? "New chat"}</div>
            <div className="hidden text-xs text-muted-foreground sm:block">Proxy to backend through /api/proxy</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={sessions.createSession} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent md:hidden">New</button>
            <button type="button" onClick={actions.runHealthCheck} disabled={actions.loading} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">Health</button>
            <button type="button" onClick={actions.listInvoices} disabled={actions.loading} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">Invoices</button>
            {sessions.activeMessages.length > 0 && <button type="button" onClick={sessions.clearActiveSession} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">Clear</button>}
          </div>
        </header>
        <main className="min-h-0 flex-1">
          <ConversationPanel messages={sessions.activeMessages} loading={actions.loading} loadingLabel={actions.loadingLabel} onUsePrompt={actions.sendMessage} onToggleRaw={sessions.toggleRaw} />
        </main>
        <ChatComposer value={input} disabled={actions.loading} onChange={setInput} onSubmit={() => actions.sendMessage()} />
      </div>
    </div>
  );
}
