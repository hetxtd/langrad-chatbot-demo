import { NextRequest } from 'next/server'
import { OpenAI } from 'openai'
import { buildIndex, embedQuery, topK } from '../../../lib/rag'

export const dynamic = 'force-dynamic'

const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY in .env.local' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const { message, history } = await req.json()
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // RAG
    const index = await buildIndex(client, EMBED_MODEL)
    const qvec = await embedQuery(client, EMBED_MODEL, message)
    const hits = topK(index, qvec, 5)
    const context = hits.map(h => `[${h.doc.title}]\n${h.doc.body.slice(0, 1200)}`).join('\n\n')

    // Light rails, human tone
    const system = `
You are the Langrad assistant. Be natural, concise, and helpful (2–5 sentences).
Use info from internal context; don't show citations or file names.

Rails:
- Never give prices or exact timelines; say engineering will confirm.
- If user asks about quote/timeline/site visit/contact/drawings, OFFER a handoff (“I can have engineering follow up — want me to take your details?”).
- Do not ask for contact details unless the user clearly says yes / ok / proceed or indicates they’re done.

Style examples:
- “We can handle that. Engineering usually checks site access and specs before confirming timelines. Want me to have them follow up?”
- “Yes, food-grade vertical tanks are fine. I can pass this along for a quote and schedule if you like.”
- “Got it. Anything else you want to add, or should I send this over?” (use sparingly)
`

    const userPrompt = `
Context (internal only):
${context}

User message:
${message}

Reply as a warm, human coordinator. Answer first; if they ask for quote/timeline/contact, OFFER a follow-up (one short line).
Do not collect details yourself; wait for explicit user consent or “done”. No citations, no contacts, no filler.
`

    const messages = [
      { role: 'system', content: system },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: userPrompt },
    ] as const

    const resp = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.55,
    })

    const answer = resp.choices[0]?.message?.content ?? ''

    return new Response(JSON.stringify({ answer }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.error('API /api/chat error:', e?.message || e)
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
