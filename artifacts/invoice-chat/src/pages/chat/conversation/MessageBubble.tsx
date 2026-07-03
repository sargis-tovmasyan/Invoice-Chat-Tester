import type { ChatMessage } from "../chat.types";
import { ResponsePayload } from "../response-cards/ResponseCards";

interface MessageBubbleProps {
  message: ChatMessage;
  onToggleRaw: (messageId: string) => void;
}

export function MessageBubble({ message, onToggleRaw }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isError
            ? "border border-destructive/20 bg-destructive/10 text-destructive"
            : isSystem
            ? "border border-border bg-muted text-muted-foreground"
            : "border border-border bg-card text-card-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
        <ResponsePayload payload={message.payload} showRaw={message.showRaw} onToggleRaw={() => onToggleRaw(message.id)} />
      </div>
    </div>
  );
}
