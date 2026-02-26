import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────

const EN_SYSTEM_PROMPT = `You are a compassionate patient educator for an Indian healthcare app.
Your job: translate a doctor's medical JSON into simple, warm language a patient with no medical background can understand.

Rules:
- Use plain English (Class 5 reading level). No jargon.
- For medications: describe the pill by effect and timing, e.g. "Take 1 white tablet after breakfast every day for fever"
- Write a short, reassuring headline.
- Give exactly 3 bullet points summarising the visit (what was found, what to do, what to avoid).
- Write medication_instructions as a plain array of strings, one sentence each.
- Write a follow_up sentence when to return.
- Keep a warm, encouraging but factual tone.
- Output valid JSON only.

Output schema:
{
  "headline": "string — one reassuring sentence about today's visit",
  "bullets": ["string", "string", "string"],
  "medication_instructions": ["one sentence per medication"],
  "follow_up": "string — when and why to come back",
  "red_flags": ["string — 1-3 warning signs to watch for, urgent if present"]
}`;

const HI_SYSTEM_PROMPT = `Aap ek bharosemand patient educator hain jo doctor ki medical report ko simple Hindi mein samjhate hain.

Niyam:
- Aam bolchal ki Hindi likhein. Koi medical shabd nahi.
- Dawaon ke liye: pill ka asar aur time batao, jaise "roz subah khane ke baad 1 safed tablet lo bukhaar ke liye"
- Ek chhota reassuring headline likho.
- Theek 3 bullet points mein visit ka summary do.
- Har dawai ke liye ek sentence medication_instructions mein.
- Follow-up mein batao kab wapas aana hai.
- Sirf valid JSON likhein.

Output schema (same as English):
{
  "headline": "string",
  "bullets": ["string", "string", "string"],
  "medication_instructions": ["string"],
  "follow_up": "string",
  "red_flags": ["string"]
}`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { emr, patientName, language = "en" } = await request.json();

    if (!emr) {
      return NextResponse.json({ error: "EMR data required" }, { status: 400 });
    }

    const systemPrompt = language === "hi" ? HI_SYSTEM_PROMPT : EN_SYSTEM_PROMPT;

    // Build a concise EMR digest to send (avoid token bloat)
    const emrDigest = {
      chief_complaint: emr.chief_complaint ?? "",
      symptoms: emr.symptoms ?? [],
      diagnosis: emr.diagnosis ?? [],
      icd_codes: (emr.icd_codes ?? []).map((c: { code: string; description: string }) => c.description),
      medications: (emr.medications ?? []).map((m: {
        name: string; dosage: string; frequency: string; duration: string;
      }) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
      })),
      lab_tests_ordered: emr.lab_tests_ordered ?? [],
      vitals: emr.vitals ?? {},
    };

    const userContent = `Patient name: ${patientName ?? "Patient"}
Language: ${language === "hi" ? "Hindi" : "English"}

Doctor's medical record:
${JSON.stringify(emrDigest, null, 2)}

Generate the patient-friendly summary JSON now.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const summary = JSON.parse(raw);

    return NextResponse.json({ summary, language, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error("[PatientSummary API] Error:", error);
    return NextResponse.json(
      { error: "Summary generation failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
