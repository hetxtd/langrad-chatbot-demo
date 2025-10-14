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
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { message, history } = await req.json()
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // RAG retrieval
    const index = await buildIndex(client, EMBED_MODEL)
    const qvec = await embedQuery(client, EMBED_MODEL, message)
    const hits = topK(index, qvec, 5)
    const context = hits.map(h => `[${h.doc.title}]\n${h.doc.body.slice(0, 1200)}`).join('\n\n')

    // Concise, human persona (HeTxtd style)
    const assistantPreamble =
      "You are a calm project assistant for Langrad EMC. Understand Nigerian English and Pidgin. " +
      "Answer first in 3–6 short sentences using the provided context. Ask at most one short follow-up. " +
      "Do not show citations or file names. Never promise price or dates; say engineering will confirm. " +
      "Do not ask for contact details or mention WhatsApp unless the user asks for price/quote/timeline/site visit/drawings/engineer, or says they have no more questions. " +
      "Acknowledge details the user already provided (e.g., location) and do not ask for them again."

    const contentPrompt =
`Context (for you to use internally):
${context}

User: ${message}

Reply like a human assistant. Be concise and specific. 
If anything is unclear, say you'll confirm with engineering.
Do not include a 'Sources' section or links in your answer.`

    const messages = [
      { role: 'system', content: assistantPreamble },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: contentPrompt },
    ] as any

    const resp = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.2,
    })

    const answer = resp.choices[0]?.message?.content ?? ''

    // Clean human answer only
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('API /api/chat error:', e?.message || e)
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
