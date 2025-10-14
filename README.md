# Langrad EMC — Next.js + Tailwind RAG Chatbot (Starter)

Clean, production‑lean demo using **Next.js 14 (app router)** + **Tailwind** with a minimal RAG pipeline:
- Loads chunked markdown from `public/rag_data`
- Builds an embedding index on first request (cached to `.cache/index.json`)
- Retrieves top chunks and calls OpenAI Chat with strict **policy guardrails**
- Returns answer + **Sources**

## Quick Start

```bash
pnpm i    # or npm i / yarn
cp .env.example .env.local    # add your OpenAI key
pnpm dev  # or npm run dev / yarn dev
```

Open http://localhost:3000 and chat.

### Deploy
For Vercel, add env vars:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `OPENAI_EMBED_MODEL` (default `text-embedding-3-small`)

> Tip: For persistent indexing on serverless, precompute embeddings during build or ship the index file; this starter builds at runtime for local demos.

### Hand‑off
When approved, replace the key with your uncle’s in project settings (.env.local or Vercel env).

### Structure
```
app/
  api/chat/route.ts   # server endpoint: retrieval + OpenAI chat
  components/Chat.tsx # UI
  page.tsx            # layout + sidebar
lib/rag.ts            # tiny RAG helper (embeddings, cosine, cache)
public/rag_data       # your chunked markdown + policy
.cache/index.json     # generated on first request
```