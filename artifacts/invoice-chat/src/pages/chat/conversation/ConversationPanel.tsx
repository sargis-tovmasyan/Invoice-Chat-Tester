import { useEffect, useRef } from "react";
import type { ChatMessage } from "../chat.types";
import { EmptyChatState } from "./EmptyChatState";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface ConversationPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  loadingLabel: string;
  onUsePrompt: (prompt: string) => void;
  onToggleRaw: (messageId: string) => void;
}

export function ConversationPanel({ messages, loading, loadingLabel, onUsePrompt, onToggleRaw }: ConversationPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return <EmptyChatState onUsePrompt={onUsePrompt} />;
  }

  return (
    <div className="chat-scroll h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onToggleRaw={onToggleRaw} />
        ))}
        {loading && <TypingIndicator label={loadingLabel} />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
