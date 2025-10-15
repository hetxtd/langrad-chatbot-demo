// app/page.tsx
import Image from 'next/image'
import Chat from './components/Chat'
import '../styles/globals.css'

export default function Page() {
  return (
    <main className="container">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Image
            src="/langrad-logo.png"
            alt="Langrad EMC"
            width={40}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <span className="brand-chip">Demo</span>
        </div>

        <h1 className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>
          Langrad AI Chatbot
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          AI assistant for steel fabrication, tanks, silos & civil works.
        </p>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Demo build automates enquiries and routes qualified leads to WhatsApp.
        </p>
      </header>

      <section className="card" style={{ borderTop: '4px solid var(--brand)' }}>
        <Chat />
      </section>

      <footer className="mt-10 text-center">
        <p>© {new Date().getFullYear()} Langrad EMC. All rights reserved.</p>
        <p className="mt-1">
          Built by <a href="mailto:nasadewolu@gmail.com">Nasir Adewolu</a>
        </p>
      </footer>
    </main>
  )
}
