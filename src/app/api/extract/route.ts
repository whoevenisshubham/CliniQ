import { containLegacyRoute } from "@/lib/server/containment";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { buildEpidemiologyContext } from "@/lib/epidemiology";

function getGroq() {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/server/ai/prompts";

async function legacyPOST(request: Request) {
  const groq = getGroq();
  try {
    const { transcript, consultationId, existingEMR, location } = await request.json();

    if (!transcript || transcript.length < 20) {
      return NextResponse.json(
        { error: "Transcript too short for extraction" },
        { status: 400 }
      );
    }

    // Build epidemiology context (default: Pune)
    const epiCtx = buildEpidemiologyContext(location ?? "pune");

    const differentialsPrompt = `You are a clinical differential diagnosis engine for Indian healthcare.
Based on the patient's symptoms and transcript, generate a ranked differential diagnosis list.

${epiCtx.llmContextBlock}

INSTRUCTIONS:
- Return a JSON object with key "differentials" containing an array
- Max 5 differentials, ranked by probability (highest first)
- Seasonal/endemic conditions consistent with symptoms should be weighted HIGHER per the epidemiological context above
- Each entry: {"condition": string, "probability": number 0-100, "reasoning": string, "suggested_tests": [string], "icd_code": string|null}
- The "reasoning" field MUST explain if seasonal weighting was applied`;

    // Run extraction and differentials in parallel
    const [extractionResponse, differentialsResponse] = await Promise.all([
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract medical data from this consultation transcript:\n\n---\n${transcript}\n---\n\n${existingEMR ? `Existing EMR context: ${JSON.stringify(existingEMR)}` : ""}`,
          },
        ],
      }),
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: differentialsPrompt },
          {
            role: "user",
            content: `Consultation transcript:\n${transcript}`,
          },
        ],
      }),
    ]);

    const emr = JSON.parse(extractionResponse.choices[0]?.message?.content ?? "{}");
    let differentials: unknown[] = [];

    try {
      const diffRaw = JSON.parse(differentialsResponse.choices[0]?.message?.content ?? "{}");
      differentials = Array.isArray(diffRaw)
        ? diffRaw
        : Array.isArray(diffRaw.differentials)
          ? diffRaw.differentials
          : [];
    } catch {
      differentials = [];
    }

    return NextResponse.json({
      emr,
      differentials,
      consultationId,
      epidemiology: {
        season: epiCtx.seasonLabel,
        location: epiCtx.location,
        alert_note: epiCtx.alertNote,
      },
      extracted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Extract API] Error:", error);
    return NextResponse.json(
      { error: "Extraction failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Quarantined pending scoped service and database-policy verification.
export const POST = containLegacyRoute(legacyPOST);
