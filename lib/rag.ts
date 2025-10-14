import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { OpenAI } from 'openai'

export type Doc = {
  id: string
  title: string
  source_url?: string
  tags?: string[]
  body: string
  file: string
}

export type Index = {
  embeddings: number[][]
  docs: Doc[]
  model: string
}

const RAG_DIR = path.join(process.cwd(), 'public', 'rag_data')
const CACHE_PATH = path.join(process.cwd(), '.cache', 'index.json')

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    dot += x*y; na += x*x; nb += y*y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1
  return dot / denom
}

function hashDocs(docs: Doc[]): string {
  const h = crypto.createHash('sha1')
  for (const d of docs) h.update(d.id + d.title + d.body)
  return h.digest('hex')
}

export async function loadDocs(): Promise<Doc[]> {
  const files = await fs.readdir(RAG_DIR)
  const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('000_system_retrieval_policy'))
  const docs: Doc[] = []
  for (const f of mdFiles) {
    const full = path.join(RAG_DIR, f)
    const text = await fs.readFile(full, 'utf8')
    let meta: any = {}, body = text
    if (text.startsWith('---')) {
      const parts = text.split('---')
      try { meta = JSON.parse(JSON.stringify(parseYAML(parts[1]))) } catch {}
      body = parts.slice(2).join('---').trim()
    }
    docs.push({
      id: meta?.id || f.replace('.md',''),
      title: meta?.title || f.replace('.md',''),
      source_url: meta?.source_url || '',
      tags: meta?.tags || [],
      body,
      file: f
    })
  }
  return docs
}

// Tiny YAML parser for front-matter (only key: value and arrays)
function parseYAML(y: string): any {
  const obj: any = {}
  let currentKey: string | null = null
  for (const raw of y.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    if (line.includes(':') && !line.startsWith('-')) {
      const [k, ...rest] = line.split(':')
      const v = rest.join(':').trim()
      if (v.startsWith('[') && v.endsWith(']')) {
        obj[k.trim()] = v.slice(1,-1).split(',').map(s => s.trim()).filter(Boolean)
      } else {
        obj[k.trim()] = v.replace(/^"|"$/g,'')
      }
      currentKey = k.trim()
    } else if (line.startsWith('-') && currentKey) {
      if (!Array.isArray(obj[currentKey])) obj[currentKey] = []
      obj[currentKey].push(line.replace(/^-\s*/,''))
    }
  }
  return obj
}

export async function loadPolicy(): Promise<string> {
  const policyPath = path.join(RAG_DIR, '000_system_retrieval_policy.md')
  return fs.readFile(policyPath, 'utf8')
}

export async function buildIndex(client: OpenAI, embedModel: string): Promise<Index> {
  const docs = await loadDocs()
  const cacheKey = hashDocs(docs) + embedModel
  // try cache
  try {
    const cachedRaw = await fs.readFile(CACHE_PATH, 'utf8')
    const cached = JSON.parse(cachedRaw) as Index & { key: string }
    if (cached.key === cacheKey) return { embeddings: cached.embeddings, docs: cached.docs, model: cached.model }
  } catch {}

  const inputs = docs.map(d => d.body.slice(0, 2000))
  const embs: number[][] = []
  const B = 64
  for (let i = 0; i < inputs.length; i += B) {
    const batch = inputs.slice(i, i+B)
    const resp = await client.embeddings.create({ model: embedModel, input: batch })
    for (const d of resp.data) embs.push(d.embedding as unknown as number[])
  }
  const index: Index = { embeddings: embs, docs, model: embedModel }
  const payload = JSON.stringify({ ...index, key: cacheKey })
  await fs.writeFile(CACHE_PATH, payload, 'utf8')
  return index
}

export function topK(index: Index, queryVec: number[], k = 5): { score: number, doc: Doc }[] {
  const res = index.embeddings.map((e, i) => ({ score: cosineSim(e, queryVec), doc: index.docs[i] }))
  return res.sort((a,b) => b.score - a.score).slice(0, k)
}

export async function embedQuery(client: OpenAI, embedModel: string, q: string): Promise<number[]> {
  const resp = await client.embeddings.create({ model: embedModel, input: q })
  return resp.data[0].embedding as unknown as number[]
}