import { useRef } from "react";

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSubmit }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      className="border-t border-border bg-background/95 p-4 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
        textareaRef.current?.focus();
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg">
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          rows={1}
          placeholder="Message Document AI..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </form>
  );
}
