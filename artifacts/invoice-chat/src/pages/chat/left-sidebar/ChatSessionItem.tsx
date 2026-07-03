import type { ChatSession } from "../chat.types";

interface ChatSessionItemProps {
  session: ChatSession;
  active: boolean;
  archived?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onArchive: () => void;
  onRemove: () => void;
}

export function ChatSessionItem({
  session,
  active,
  archived = false,
  onSelect,
  onRename,
  onArchive,
  onRemove,
}: ChatSessionItemProps) {
  return (
    <div
      className={`group rounded-xl border px-3 py-2 transition ${
        active
          ? "border-primary/30 bg-primary/10 shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/70"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="truncate text-sm font-medium">{session.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {session.messages.length} message{session.messages.length === 1 ? "" : "s"}
        </div>
      </button>

      <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button type="button" onClick={onRename} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
          Rename
        </button>
        {!archived && (
          <button type="button" onClick={onArchive} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
            Archive
          </button>
        )}
        <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
          Remove
        </button>
      </div>
    </div>
  );
}
