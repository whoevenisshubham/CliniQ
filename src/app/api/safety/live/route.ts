import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

export const maxDuration = 10; // set a max duration since groq is fast

function getGroq() {
    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// System prompt optimized for speed and precise JSON extraction
const SYSTEM_PROMPT = `You are a clinical safety AI (Liability Shield).
Your task is to analyze snippets of a live doctor-patient consultation transcript and detect if the doctor mentions prescribing a new medication that explicitly conflicts with the patient's known allergies or chronic conditions.

Rules:
1. ONLY return a JSON array of alerts under the key "alerts".
2. If no conflict is found, return { "alerts": [] }
3. Be strict: only flag if a specific medication is actively being proposed/prescribed and it conflicts with the profile.
4. Each alert must have: "drug" (the medication name), "reason" (short explanation of the conflict), "severity" (always "critical" for allergy/condition conflicts).

JSON format:
{
  "alerts": [
    { "drug": "String", "reason": "String", "severity": "critical" }
  ]
}`;

export async function POST(request: Request) {
    const groq = getGroq();
    try {
        const { transcriptChunk, patientAllergies, chronicConditions } = await request.json();

        if (!transcriptChunk || transcriptChunk.length < 10) {
            return NextResponse.json({ alerts: [] });
        }

        const allergiesArr = Array.isArray(patientAllergies) ? patientAllergies : [];
        const conditionsArr = Array.isArray(chronicConditions) ? chronicConditions : [];

        // If patient has no history, no alerts can be generated
        if (allergiesArr.length === 0 && conditionsArr.length === 0) {
            return NextResponse.json({ alerts: [] });
        }

        const patientContext = `
Patient History:
- Allergies: ${allergiesArr.length ? allergiesArr.join(", ") : "None reported"}
- Chronic Conditions: ${conditionsArr.length ? conditionsArr.join(", ") : "None reported"}

Transcript Snippet:
"${transcriptChunk}"
`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: patientContext }
            ],
            model: "llama-3.3-70b-versatile", // fast model
            temperature: 0, // deterministic
            response_format: { type: "json_object" },
        });

        const responseContent = chatCompletion.choices[0]?.message?.content || '{"alerts": []}';
        const parsed = JSON.parse(responseContent);

        return NextResponse.json({
            alerts: parsed.alerts || [],
            checked_at: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Live Safety API] Error:", error);
        return NextResponse.json(
            { error: "Safety processing failed", alerts: [] },
            { status: 500 }
        );
    }
}
