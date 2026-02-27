import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PRESCRIPTION_EXTRACTION_PROMPT = `You are a medical prescription OCR and extraction engine for an Indian healthcare platform.

You will receive an image of a medical prescription. Extract ALL medication details and doctor information from it.

RULES:
- Extract EVERY medication mentioned, do NOT skip any
- For each medication, extract: name (brand or generic), dose/strength, frequency, duration, route
- If handwriting is unclear, provide your best interpretation with a confidence note
- Extract doctor name, clinic name, date if visible
- Extract patient name if visible
- If any field is not visible or unclear, use null

Return ONLY valid JSON matching this schema:
{
  "doctor_name": "string | null",
  "clinic_name": "string | null", 
  "date": "string | null",
  "patient_name": "string | null",
  "medications": [
    {
      "name": "string - medication name",
      "dose": "string - e.g. 500mg",
      "frequency": "string - e.g. Twice daily",
      "duration": "string - e.g. 7 days",
      "route": "string - e.g. Oral",
      "notes": "string | null - any additional instructions"
    }
  ],
  "diagnosis": ["string - if mentioned on prescription"],
  "notes": "string | null - any additional notes from prescription",
  "confidence": "high | medium | low - overall extraction confidence"
}`;

// Llama 3.2 vision models were decommissioned April 2025
// Replacement: Llama 4 Scout (multimodal, supports vision)
const VISION_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
];

export async function POST(request: Request) {
    try {
        const { image_base64, image_url } = await request.json();

        if (!image_base64 && !image_url) {
            return NextResponse.json(
                { error: "No image provided. Send either image_base64 or image_url." },
                { status: 400 }
            );
        }

        // Check image size — Groq has limits on payload size (~4MB)
        if (image_base64 && image_base64.length > 5_000_000) {
            return NextResponse.json(
                { error: "Image too large. Please use an image under 4MB." },
                { status: 400 }
            );
        }

        // Build image content for Groq Vision
        const imageContent = image_base64
            ? { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
            : { type: "image_url" as const, image_url: { url: image_url } };

        // Try each model until one works
        let response;
        let usedModel = "";
        let lastError: unknown = null;

        for (const model of VISION_MODELS) {
            try {
                console.log(`[Prescription Scan] Trying model: ${model}`);
                response = await groq.chat.completions.create({
                    model,
                    temperature: 0.1,
                    max_tokens: 2048,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: PRESCRIPTION_EXTRACTION_PROMPT },
                                imageContent,
                            ],
                        },
                    ],
                });
                usedModel = model;
                console.log(`[Prescription Scan] Success with model: ${model}`);
                break;
            } catch (err) {
                console.error(`[Prescription Scan] Model ${model} failed:`, err instanceof Error ? err.message : err);
                lastError = err;
            }
        }

        if (!response) {
            const errMsg = lastError instanceof Error ? lastError.message : "All vision models failed";
            console.error("[Prescription Scan] All models failed. Last error:", errMsg);
            return NextResponse.json(
                { error: `Vision model error: ${errMsg}` },
                { status: 500 }
            );
        }

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        console.log("[Prescription Scan] Raw response length:", rawContent.length);

        // Try to parse as JSON — the model sometimes wraps in markdown code blocks
        let parsed;
        try {
            const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
            parsed = JSON.parse(jsonMatch[1]?.trim() ?? rawContent);
        } catch {
            console.error("[Prescription Scan] JSON parse failed. Raw:", rawContent.substring(0, 500));
            return NextResponse.json({
                error: "Could not parse extraction result",
                raw_response: rawContent,
                medications: [],
                confidence: "low",
            });
        }

        return NextResponse.json({
            ...parsed,
            extracted_at: new Date().toISOString(),
            source: "prescription_scan",
            model: usedModel,
        });
    } catch (error) {
        console.error("[Prescription Scan API] Error:", error instanceof Error ? error.message : error);
        console.error("[Prescription Scan API] Stack:", error instanceof Error ? error.stack : "N/A");
        return NextResponse.json(
            { error: "Prescription scan failed", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
