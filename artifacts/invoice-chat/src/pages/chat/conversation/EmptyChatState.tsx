const EXAMPLE_PROMPTS = [
  "Hi",
  "Show me all my invoices",
  "Create invoice INV-001 from Sargis Studio for client Alex Johnson, issued 2026-06-28, due 2026-07-05, USD — website design $300",
];

interface EmptyChatStateProps {
  onUsePrompt: (prompt: string) => void;
}

export function EmptyChatState({ onUsePrompt }: EmptyChatStateProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">AI</div>
      <h1 className="text-2xl font-bold tracking-tight">How can I help with documents?</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Create invoices, inspect generated documents, or ask the assistant a simple question.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onUsePrompt(prompt)}
            className="rounded-2xl border border-border bg-card p-4 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
