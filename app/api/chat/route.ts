import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const dynamic = "force-dynamic"; // disable caching

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in environment." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Accept either { message, history } or { userPrompt, messages }
    const body = await req.json();
    const userPrompt: string =
      (body?.userPrompt ?? body?.message ?? "").toString();
    const historyIn: any[] = Array.isArray(body?.messages)
      ? body.messages
      : Array.isArray(body?.history)
      ? body.history
      : [];

    // Build typed message history
    const historyMsgs: ChatCompletionMessageParam[] = historyIn.map((m: any) => ({
      role: (m?.role as "system" | "user" | "assistant") ?? "user",
      content: String(m?.content ?? ""),
    }));

    // System rails (lightweight)
    const system = `
You are the Langrad assistant. Be natural, concise (2–5 sentences), and helpful.
Never promise exact prices or timelines; say engineering will confirm.
Offer to take contact details only when the user asks for quote/timeline/site visit or agrees to proceed.
No citations or file names.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...historyMsgs,
      { role: "user", content: userPrompt },
    ];

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.55,
    });

    const reply =
      resp.choices?.[0]?.message?.content?.trim() ||
      "I'm here to help. Could you rephrase that?";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("API /api/chat error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
