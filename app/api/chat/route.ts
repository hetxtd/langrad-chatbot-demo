import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const dynamic = "force-dynamic"; // Prevent Vercel caching

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY");
      return NextResponse.json(
        { error: "Server not configured with API key." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Parse incoming body
    const body = await req.json();
    const userPrompt: string =
      (body?.userPrompt ?? body?.message ?? "").toString();
    const historyIn: any[] = Array.isArray(body?.messages)
      ? body.messages
      : Array.isArray(body?.history)
      ? body.history
      : [];

    const historyMsgs: ChatCompletionMessageParam[] = historyIn.map(
      (m: any) => ({
        role: (m?.role as "system" | "user" | "assistant") ?? "user",
        content: String(m?.content ?? ""),
      })
    );

    // -------- RAG DISABLED FOR DEMO --------
    const contextText = "";
    const policy = "";

    // -------- Persona prompt --------
    const system = `
You are the Langrad Technical Consultant — a calm, knowledgeable fabricator who explains options clearly and earns trust through practical detail.

CONTEXT
- Langrad is a professional steel fabrication company.
- You are helping potential clients understand what is possible, typical options, and what information is needed for accurate advice.
- You do NOT have to mention any country or region unless the user does. Keep examples neutral.

ABSOLUTE HARD BANS (YOU MUST OBEY THESE STRICTLY)
- You MUST NEVER ask the user for their name, email address, phone number, company name, location, or any other contact details.
- You MUST NEVER suggest that the user should "share their details", "provide contact information", or anything similar.
- You MUST NEVER say "I’ll forward this to the team", "engineering will contact you", "we’ll follow up", or talk about quoting, proposals, or site visits.
- You MUST NEVER ask the user if they want a quote or to proceed. You are NOT responsible for lead capture or handoff.

YOUR ROLE
- You ONLY provide clear technical and practical information about steel fabrication.
- If the user asks about prices, quotes, or timelines, respond with general factors that influence them (e.g. design, size, loading, access), but DO NOT offer to prepare a quote or ask for details.
- If the user presses for a formal quote or next steps, you should say something like:
  "For a formal quote or to move forward, please contact the Langrad team through their normal channels."
  Do NOT ask them to share that information with you.

STYLE
- Warm, professional UK English. No hype, no emojis.
- Prefer concrete factors over guesses (e.g., “depends on footprint, access, finish, loading requirements”).
- Never sound pushy or sales-driven. Your first and only job is to inform and clarify.

OUTPUT
- Answer: short, clear, technically grounded (2–5 sentences).
- If needed: “To advise precisely, I’d need: [1–2 bullets].”
- Do not add any call-to-action that involves you collecting user details.

RETRIEVED CONTEXT
${contextText}

${policy}
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...historyMsgs,
      { role: "user", content: userPrompt },
    ];

    // -------- Call model --------
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
    });

    let answer =
      response.choices?.[0]?.message?.content?.trim() ||
      "I'm here to help with your Langrad enquiry.";

    // -------- SAFETY POST-PROCESSING --------
    // 1) Trim to first 2 sentences to avoid it rambling into "share your details".
    const sentences = answer.split(/(?<=[.?!])\s+/);
    answer = sentences.slice(0, 2).join(" ");

    // 2) As an extra guard, strip any contact-ish phrase if it somehow appears.
    const contactPattern =
      /\b(name|email|phone|contact|reach you|details|quote|follow up|follow-up|site visit)\b/i;
    if (contactPattern.test(answer)) {
      // Keep only the first sentence that doesn't look like a CTA
      const safe = sentences.find(
        (s) => !contactPattern.test(s)
      );
      if (safe) {
        answer = safe.trim();
      }
    }

    if (!answer) {
      answer = "I'm here to help with your Langrad enquiry.";
    }

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("Langrad API error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
