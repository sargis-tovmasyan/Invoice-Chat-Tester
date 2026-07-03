---
name: Beginner-friendly UI folder structure
description: How to organize a React app's files when the user explicitly says they are not skilled in frontend and wants an easy-to-navigate structure.
---

When a user says they aren't skilled in frontend and want a structure where "it's easy to find what is where," organize `src/` by visible UI area (one folder per screen region: sidebar, header, conversation/main area, composer/input, settings) rather than by technical layer (hooks/, contexts/, utils/ dumped together).

**Why:** A folder named after what the user sees on screen ("Sidebar", "Composer") is navigable without React knowledge; a folder named after a pattern ("hooks", "contexts") is not.

**How to apply:** Split a monolithic `App.tsx` into `components/<UiArea>/<Component>.tsx`, plus flat top-level concerns that don't map to a visible area: `api/` (network calls), `lib/` (pure helpers/constants), `types.ts` (shared types), `session/` (non-visible state helpers). Keep `App.tsx` itself as the thin top-level page that wires the areas together — it should be readable as an outline of the page, not contain business logic.
