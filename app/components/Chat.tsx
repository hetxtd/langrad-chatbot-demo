'use client'

import { useEffect, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

// Simple email check
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s.trim())

// Very soft phone check – just “looks like a phone number”
const isPhoneLike = (s: string) => {
  const digits = s.replace(/\D/g, '')
  return digits.length >= 7 // 7+ digits = good enough for demo
}

// Light heuristics to detect the user is asking for a quote/timeline
const QUOTE_OR_TIMELINE_REGEX =
  /\b(quote|pricing|price|cost|estimate|timeline|lead\s*time|site\s*visit|follow[-\s]?up)\b/i

// Signals that indicate project specificity (we accumulate across history)
const PROJECT_SIGNAL_REGEXES: RegExp[] = [
  // Removed Nigerian locations – keep it generic / industrial
  /\b(factory|plant|site|warehouse|yard|installation)\b/i,
  /\b(food[-\s]?grade|stainless|316|304|galvanis(e|ed)|powder\s*coat)\b/i,
  /\b(vertical|silo|tank|vessel|canopy|frame|lean[-\s]?to|portal\s*frame)\b/i,
  /\bfoundation|access|cran(e|age)|logistics|site\s*survey|drawing(s)?|design\b/i,
  /\b\d+\s*(kl|l|lit(re|er)s?|m3|tons?)\b/i,
  /\b\d+(\.\d+)?\s*(m|mm)\b/i,
  /\bcapacity|dimensions|span|height|width|diameter\b/i,
]

// Words like “ok/okay/that’s all/done” must NOT trigger intake
const NON_CONSENT_ACK =
  /\b(ok(ay)?|alright|that('?s| is)? all|done|nothing else|we('?re| are)? done)\b/i

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hi there! I’m the Langrad assistant. How can I help today?" },
  ])
  const [input, setInput] = useState('')

  // Intake state
  const [collecting, setCollecting] = useState<'none' | 'name' | 'email' | 'phone' | 'done'>('none')
  const [lead, setLead] = useState({ name: '', email: '', phone: '' })
  const [intakeStarted, setIntakeStarted] = useState(false)
  const [awaitingProceedConfirm, setAwaitingProceedConfirm] = useState(false)

  const [showForwardBadge, setShowForwardBadge] = useState(false)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const el = document.getElementById('chat-scroll')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, showForwardBadge, waiting])

  function append(role: 'user' | 'assistant', content: string) {
    setMessages(prev => [...prev, { role, content }])
  }

  // Count how many project signals we’ve seen across the thread
  function countProjectSignals(allText: string): number {
    let count = 0
    for (const rx of PROJECT_SIGNAL_REGEXES) {
      if (rx.test(allText)) count++
    }
    return count
  }

  async function askLLM(user: string) {
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: user, history }),
    })
    if (!res.ok) return `I couldn't reach the server (status ${res.status}). Please try again.`
    const data = await res.json()
    return String(data.answer || '')
  }

  function startIntake() {
    if (intakeStarted) return
    setIntakeStarted(true)
    setAwaitingProceedConfirm(false)
    append(
      'assistant',
      "Okay — I’ll take your details and pass this to the engineering team so they can follow up properly."
    )
    append('assistant', "What’s your name?")
    setCollecting('name')
  }

  async function send() {
    const q = input.trim()
    if (!q) return
    setInput('')
    append('user', q)

    // ---- Intake continuation ----
    if (collecting === 'name') {
      setLead(v => ({ ...v, name: q }))
      append('assistant', 'Thanks. What’s your email address?')
      setCollecting('email')
      return
    }
    if (collecting === 'email') {
      if (!isEmail(q)) {
        append(
          'assistant',
          "That email didn’t look right. Please enter a valid email (for example: name@company.com)."
        )
        return
      }
      setLead(v => ({ ...v, email: q }))
      append('assistant', 'Great. What’s the best phone number to reach you on?')
      setCollecting('phone')
      return
    }
    if (collecting === 'phone') {
      if (!isPhoneLike(q)) {
        append(
          'assistant',
          'That didn’t look like a phone number. Please include the full number with dialling code if possible.'
        )
        return
      }
      setLead(v => ({ ...v, phone: q.trim() }))
      append(
        'assistant',
        "Perfect — I’ll forward this to the engineering team so they can come back to you with next steps."
      )
      setCollecting('done')
      setTimeout(() => setShowForwardBadge(true), 600)
      append(
        'assistant',
        'Forwarding summary:\n*Project details recorded for engineering — they will follow up with you.*'
      )
      return
    }

    // ---- Proceed confirmation step (neutral) ----
    if (awaitingProceedConfirm) {
      const hasEmail = isEmail(q)
      const hasPhone = isPhoneLike(q)
      const affirmative =
        /\b(yes|yep|yeah|please|proceed|go ahead|send (me )?(the )?quote|book( a)? site (visit)?|let('s| us) proceed|move forward|follow up)\b/i.test(
          q
        ) && !NON_CONSENT_ACK.test(q)

      if (hasEmail || hasPhone || affirmative) {
        if (!intakeStarted) {
          setIntakeStarted(true)
          if (hasEmail) setLead(v => ({ ...v, email: q }))
          if (hasPhone) setLead(v => ({ ...v, phone: q.trim() }))
        }
        setAwaitingProceedConfirm(false)

        if (!lead.name) {
          append(
            'assistant',
            "Okay — I’ll take your details and pass this to the engineering team so they can follow up properly."
          )
          append('assistant', "What’s your name?")
          setCollecting('name')
        } else if (!lead.email) {
          append('assistant', 'Great — what’s your email address?')
          setCollecting('email')
        } else if (!lead.phone) {
          append('assistant', 'And what’s the best phone number to reach you on?')
          setCollecting('phone')
        } else {
          append(
            'assistant',
            "Perfect — I’ll forward this to the engineering team so they can come back to you with next steps."
          )
          setCollecting('done')
          setTimeout(() => setShowForwardBadge(true), 600)
          append(
            'assistant',
            'Forwarding summary:\n*Project details recorded for engineering — they will follow up with you.*'
          )
        }
        return
      } else {
        setAwaitingProceedConfirm(false)
        append('assistant', "No problem — we can keep discussing. What would you like to know next?")
        // fall through to LLM
      }
    }

    // ---- Normal: ask the model, free conversation ----
    setWaiting(true)
    const answer = await askLLM(q)
    setWaiting(false)
    append('assistant', answer)

    // ---- After-model: decide whether to *offer* proceed (no auto-intake) ----
    if (!intakeStarted) {
      const fullThread = [...messages, { role: 'user', content: q }, { role: 'assistant', content: answer }]
        .map(m => m.content)
        .join('\n')
      const signals = countProjectSignals(fullThread)
      const userAskedQuoteOrTimeline = QUOTE_OR_TIMELINE_REGEX.test(q)

      // Offer proceed only when the user asked for quote/timeline AND we have enough specifics
      if (userAskedQuoteOrTimeline && signals >= 3) {
        setAwaitingProceedConfirm(true)
        append(
          'assistant',
          'Would you like to proceed to a formal quote and have the team follow up, or would you prefer to keep discussing for now?'
        )
      }
      // Also, if the user voluntarily shares contact info, we can start intake on next turn via awaitingProceedConfirm
      const hasEmail = isEmail(q)
      const hasPhone = isPhoneLike(q)
      if (hasEmail || hasPhone) {
        setAwaitingProceedConfirm(true)
        append(
          'assistant',
          'Do you want me to use these details so the team can follow up formally, or would you rather keep things informal for now?'
        )
      }
    }
  }

  return (
    <div className="w-full mx-auto max-w-3xl">
      <div className="card grid gap-4" style={{ borderTop: '4px solid var(--brand)' }}>
        <div id="chat-scroll" className="h-[52vh] overflow-y-auto space-y-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className="inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3"
                style={{
                  background: m.role === 'user' ? 'var(--bubble-user)' : 'var(--bubble-assistant)',
                  color: 'var(--text-strong)',
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {waiting && (
            <div className="text-left">
              <div className="inline-block rounded-2xl px-4 py-3" style={{ background: 'var(--bubble-assistant)' }}>
                <span>typing… • • •</span>
              </div>
            </div>
          )}

          {showForwardBadge && (
            <div className="text-left mt-2">
              <button
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl shadow-md cursor-default select-none"
                style={{ background: 'var(--accent)', color: '#fff' }}
                title="Demo: visual only"
              >
                <span>Forwarded to engineering team (demo)</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-xl px-4 py-3 focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => (e.key === 'Enter' ? send() : undefined)}
          />
          <button
            onClick={send}
            className="brand-btn px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={waiting}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
