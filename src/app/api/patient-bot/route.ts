import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

function getGroq() {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const SYSTEM_PROMPT = `You are NexusMD Patient Assistant — a helpful, empathetic AI that answers patient questions about their health, medications, diagnoses, and treatment plans. 

RULES:
1. Always reference the patient's EMR context provided below when answering.
2. Use simple, patient-friendly language. Avoid complex medical jargon unless the patient asks for detail.
3. Never diagnose or prescribe — always recommend consulting their doctor for clinical decisions.
4. Every response MUST end with: "⚕️ This is AI-generated guidance based on your records. Always consult your doctor for medical decisions."
5. If the question is outside the patient's EMR context, say so honestly.
6. Be concise but thorough. Use bullet points for clarity.
7. If asked about drug interactions or side effects, provide verified information but emphasize consulting the prescribing doctor.`;

export async function POST(req: NextRequest) {
  const groq = getGroq();
  try {
    const { messages, patientContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const contextBlock = patientContext
      ? `\n\nPATIENT EMR CONTEXT:\n${JSON.stringify(patientContext, null, 2)}`
      : "";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextBlock },
        ...messages.slice(-10), // Last 10 messages for context window
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: false,
    });

    const reply = completion.choices[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[patient-bot] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
