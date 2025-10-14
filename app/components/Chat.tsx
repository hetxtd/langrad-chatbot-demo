'use client'
import { useEffect, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

// detect intent
const BUY_INTENT =
  /(quote|price|how much|timeline|lead ?time|site visit|engineer|send drawings|availability|when can|cost)/i
const DONE_REGEX =
  /\b(that('?s| is)? all|done|we('?re| are)? done|no( more)?( questions)?|nothing else|go ahead|proceed|send it|forward it|carry on|that will be all|okay go|ok go)\b/i

function normalizePhoneNGA(input: string): { ok: boolean; e164?: string } {
  let s = input.replace(/[^\d+]/g, '')
  if (s.startsWith('+234')) s = s
  else if (s.startsWith('234')) s = '+' + s
  else if (s.startsWith('0') && s.length >= 10) s = '+234' + s.slice(1)
  const ok = /^\+234\d{10}$/.test(s)
  return ok ? { ok: true, e164: s } : { ok: false }
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s.trim())

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Hi there! I'm the Langrad assistant. How can we help you today?",
    },
  ])
  const [input, setInput] = useState('')

  const [invitedHandoff, setInvitedHandoff] = useState(false)
  const [collecting, setCollecting] = useState<'none' | 'name' | 'email' | 'phone' | 'done'>('none')
  const [lead, setLead] = useState({ name: '', email: '', phone: '' })
  const [showWhatsApp, setShowWhatsApp] = useState(false)

  useEffect(() => {
    const el = document.getElementById('chat-scroll')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, showWhatsApp])

  function append(role: 'user' | 'assistant', content: string) {
    setMessages(prev => [...prev, { role, content }])
  }

  async function askLLM(user: string) {
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: user, history }),
    })
    if (!res.ok) return `Server error (${res.status}).`
    const data = await res.json()
    return String(data.answer || '')
  }

  async function send() {
    const q = input.trim()
    if (!q) return
    setInput('')
    append('user', q)

    // end-of-convo capture
    if (collecting === 'name') {
      setLead(v => ({ ...v, name: q }))
      append('assistant', 'Thanks. What’s your email address?')
      setCollecting('email')
      return
    }
    if (collecting === 'email') {
      if (!isEmail(q)) {
        append('assistant', "That email didn’t look right. Please enter a valid email (e.g., name@company.com).")
        return
      }
      setLead(v => ({ ...v, email: q }))
      append('assistant', 'Great. Best phone number to reach you? (e.g., 0803 123 4567 or +234 803 123 4567)')
      setCollecting('phone')
      return
    }
    if (collecting === 'phone') {
      const p = normalizePhoneNGA(q)
      if (!p.ok) {
        append('assistant', 'Please enter a Nigerian number like 0803 123 4567 or +234 803 123 4567.')
        return
      }
      setLead(v => ({ ...v, phone: p.e164! }))
      append('assistant', "Perfect — I’ll forward this to engineering for timelines or a quote.")
      setCollecting('done')
      setTimeout(() => setShowWhatsApp(true), 600)
      append(
        'assistant',
        "Forwarding: *4×50KL food-grade vertical tanks — Ogun — timeline & quote.*\nSend this to Engineering on WhatsApp 👇"
      )
      return
    }

    // normal convo
    const answer = await askLLM(q)
    append('assistant', answer)

    // detect “done”
    if (DONE_REGEX.test(q)) {
      append('assistant', "Got it — I’ll just take your details and forward this to our engineering team.")
      append('assistant', "What’s your name?")
      setCollecting('name')
      return
    }

    // detect buy intent
    if (!invitedHandoff && BUY_INTENT.test(q + ' ' + answer)) {
      setInvitedHandoff(true)
      setTimeout(() => {
        append(
          'assistant',
          'Would you like me to note this for a follow-up, or do you want to check one more thing first?'
        )
      }, 250)
    }
  }

  return (
    <div className="w-full mx-auto max-w-3xl">
      <div className="card p-4 grid gap-4">
        <div id="chat-scroll" className="h-[52vh] overflow-y-auto space-y-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 ${
                  m.role === 'user' ? 'bg-purple-100' : 'bg-gray-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {showWhatsApp && (
            <div className="text-left mt-2">
              <button
                className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-2xl shadow-md cursor-default select-none"
                title="Demo: visual only"
              >
                <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                  <path d="M19.11 17.08a.89.89 0 0 1-.6.27c-.27 0-.6-.09-.93-.27c-.33-.18-.75-.42-1.28-.75a8.29 8.29 0 0 1-1.4-1.12c-.42-.39-.78-.81-1.09-1.26c-.3-.45-.54-.87-.72-1.26c-.18-.39-.27-.72-.27-.99c0-.18.06-.36.18-.54c.12-.18.27-.36.45-.54c.18-.18.3-.33.45-.48c.15-.15.27-.3.36-.45c.09-.15.12-.3.12-.45c0-.18-.03-.33-.09-.45c-.06-.12-.12-.24-.18-.33l-.3-.33a1.6 1.6 0 0 0-.51-.39c-.18-.09-.36-.12-.57-.12c-.18 0-.33.03-.48.09a1.6 1.6 0 0 0-.42.24c-.12.09-.24.21-.36.33c-.36.39-.6.81-.75 1.23c-.15.42-.21.87-.21 1.35c0 .48.09.93.24 1.38c.18.45.39.9.66 1.32c.27.45.6.87.96 1.26c.36.42.72.78 1.11 1.11c.39.33.81.63 1.23.9c.42.27.84.48 1.26.66c.42.18.84.33 1.29.45c.42.12.81.18 1.23.18c.48 0 .96-.06 1.41-.21c.45-.15.87-.39 1.26-.72c.15-.12.27-.27.36-.42c.09-.15.15-.3.15-.45c0-.21-.06-.42-.18-.6a2.3 2.3 0 0 0-.33-.45c-.12-.15-.24-.27-.39-.39c-.15-.12-.27-.21-.39-.27a.73.73 0 0 0-.33-.09c-.12 0-.24.03-.33.12c-.12.06-.21.15-.33.27l-.24.24zM16 2.67c-6.9 0-12.5 5.6-12.5 12.5c0 2.22.57 4.35 1.67 6.24L4 29.33l7.06-1.83c1.77.96 3.76 1.47 5.94 1.47c6.9 0 12.5-5.6 12.5-12.5S22.9 2.67 16 2.67zm0 22.76c-1.86 0-3.6-.48-5.1-1.41l-.36-.21l-4.2 1.11l1.11-4.08l-.21-.39A9.77 9.77 0 0 1 6.5 15.17c0-5.25 4.26-9.5 9.5-9.5s9.5 4.26 9.5 9.5s-4.26 9.5-9.5 9.5z"/>
                </svg>
                Send to Engineering on WhatsApp
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => (e.key === 'Enter' ? send() : undefined)}
          />
          <button onClick={send} className="rounded-xl px-4 py-3 bg-purple-600 text-white hover:bg-purple-700">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
