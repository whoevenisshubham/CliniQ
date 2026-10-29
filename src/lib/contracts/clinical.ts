// Manual clinical authority. Unknown values stay null; no generated defaults.
export type Medication = {
    id: string;
    name: string;
    dose: string | null;
    frequency: string | null;
    duration: string | null;
    route: string | null;
    instructions: string | null;
    unknownFields: ("dose" | "frequency" | "duration" | "route")[];
};
export type ClinicalSnapshot = {
    chief_complaint: string | null;
    physical_examination: string | null;
    symptoms: string[];
    diagnosis: string[];
    medications: Medication[];
    lab_tests_ordered: string[];
    clinical_summary: string | null;
    vitals: {
        name: string;
        value: number | null;
        unit: string;
        observedAt: string | null;
    }[];
};
export type SavedSegment = {
    id: string;
    sequence: number;
    text: string;
    speaker: "clinician" | "patient" | "unknown";
    language: "en" | "hi" | "Hinglish" | "unknown";
    startMs: null;
    endMs: null;
};
export const emptySnapshot = (): ClinicalSnapshot => ({ chief_complaint: null, physical_examination: null,
    symptoms: [], diagnosis: [], medications: [], lab_tests_ordered: [], vitals: [], clinical_summary: null });
