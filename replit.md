# Document AI Tester

A ChatGPT-style tester UI for a document/invoice AI backend — chat with the assistant, and it renders replies, missing-field forms, created-invoice cards, and invoice lists.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000, hosts the proxy the frontend calls)
- The `artifacts/invoice-chat` workflow runs the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/invoice-chat run typecheck` — typecheck just this artifact
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact `artifacts/invoice-chat`, "Invoice Chat Tester")
- API: Express 5 (artifact `artifacts/api-server`) — proxies frontend requests to the user-configured external API base URL

## Where things live (artifacts/invoice-chat/src)

File structure mirrors the visible UI areas, one concern per folder:

- `App.tsx` — top-level page: owns session state and wires everything together
- `components/Sidebar/` — "New Chat" button + session list (left column)
- `components/Header/` — top bar (title, Health/Invoices quick actions, Settings toggle)
- `components/Conversation/` — the message list and every response card (InvoiceCard, InvoiceListPanel, MissingFieldsForm, RequestDebugPanel, RawToggle, TypingIndicator, MessageBubble, ConversationArea)
- `components/Composer/` — bottom text input + send button + example chips
- `components/Settings/` — SetupScreen (first run) and SettingsPanel (change API URL later)
- `api/client.ts` — all network calls (apiGet/apiPost, sendChatMessage, completeInvoiceDraft, API base URL helpers)
- `session/sessionHelpers.ts` — creates empty chat sessions
- `types.ts` — shared TS types (Message, ChatSession, ParsedPayload, etc.)
- `lib/constants.ts` — proxy base, default API URL, example prompts, form fields
- `lib/helpers.ts` — pure formatting/validation helpers
- `lib/sounds.ts` — UI sound effects

Backend: `artifacts/api-server/src/routes/proxy.ts` — proxy routes (`/chat`, `/complete`, `/health`, `/invoices`, `/pdf`); reads the `X-Api-Base` header to know which external API to forward to (falls back to `DEFAULT_VPS_BASE`).

## Architecture decisions

- Chat sessions are frontend-only, in-memory React state (no localStorage, no backend) — refreshing the page starts over, by design (no auth/DB for this tester tool).
- Every request to the external API goes through the local Express proxy so the browser never talks to it directly; the API base URL is sent per-request via the `X-Api-Base` header, not baked into the build.
- The user's configured API base URL is remembered in `localStorage` (key `invoice_ai_api_base`) — separate concern from session data, and does persist across reloads.

## Product

Chat-style tester for a document/invoice AI backend: send natural-language requests, see plain replies, invoice-creation cards, invoice list tables, missing-field forms (with submit-to-complete flow), and clear error states — all with a request/response debug panel for developers.

## User preferences

- Explicitly not skilled in frontend — keep the file structure organized by visible UI area (page / sidebar / conversation / composer / response cards / API logic) so things are easy to find.
- Do not create a new artifact for this product — always extend `artifacts/invoice-chat`.

## Gotchas

- Sessions are intentionally not persisted — don't add localStorage/db persistence for chat history unless explicitly asked.
- Always run `pnpm --filter @workspace/invoice-chat run typecheck` after touching this artifact.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
