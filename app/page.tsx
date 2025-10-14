// app/page.tsx
import Chat from './components/Chat'
import '../styles/globals.css'

export default function Page() {
  return (
    <main className="container py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Langrad AI Chatbot</h1>
        <p className="text-gray-600 mt-2">
          AI assistant for steel fabrication, tanks, silos & civil works.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Demo build — designed to automate client enquiries and route qualified leads to WhatsApp.
        </p>
      </header>

      <section className="grid gap-6">
        <Chat />
      </section>
    </main>
  )
}
