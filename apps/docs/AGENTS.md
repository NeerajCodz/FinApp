<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# FinApp docs

- Pages are Markdown files in `content/<section>/<slug>.md` with `title`, `description` and `order` frontmatter. No H1 in the body; `##`/`###` headings build the table of contents.
- Extensions: `:::note|tip|warning` … `:::` callouts and `:::tabs` … `:::` code tabs (fenced blocks with `title="Label"`).
- The API reference is generated from `convex/publicApi/routes.ts` (the same registry that serves `/api/v1/openapi.json`); don't hand-write endpoint docs.
