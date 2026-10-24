// Adapted from sujitjaju1/mediflow 45fbfb853338d5236f2c34eb83e771ac4e9307ca
// src/lib/emr/; Sujit Jaju and contributors. See docs/core-pipeline-reuse.md.
import type { EMRMedication, EMRSnapshot } from "./types";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => clean(value)).filter(Boolean);
}

function joinHumanList(values: string[]): string {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatMedication(medication: EMRMedication): string | null {
  const name = clean(medication.name);
  if (!name) return null;

  const pieces = [name];
  const dosage = clean(medication.dosage);
  const frequency = clean(medication.frequency);
  const duration = clean(medication.duration);
  const route = clean(medication.route);
  const instructions = clean(medication.instructions);

  if (dosage) pieces.push(dosage);
  if (frequency) pieces.push(frequency);
  if (duration) pieces.push(duration);
  if (route) pieces.push(route);
  if (instructions) pieces.push(instructions);

  return `${pieces.join(", ")}.`;
}

export function buildClinicalSummary(snapshot: EMRSnapshot): string | null {
  const parts: string[] = [];
  const complaint = clean(snapshot.chief_complaint);
  const diagnosis = normalizeList(snapshot.diagnosis_text);
  const medications = (snapshot.medications ?? []).map(formatMedication).filter((value): value is string => Boolean(value));
  const labTests = normalizeList(snapshot.lab_tests_ordered);

  if (complaint) parts.push(`Chief complaint: ${complaint}.`);
  if (diagnosis.length) parts.push(`Assessment: ${joinHumanList(diagnosis)}.`);
  if (medications.length) parts.push(`Medications: ${medications.join(" ")}`);
  if (labTests.length) parts.push(`Lab tests ordered: ${joinHumanList(labTests)}.`);

  return parts.length ? parts.join(" ").replace(/\s+/g, " ").trim() : null;
}

export function buildPatientSummary(snapshot: EMRSnapshot): string | null {
  const parts: string[] = [];
  const complaint = clean(snapshot.chief_complaint);
  const diagnosis = normalizeList(snapshot.diagnosis_text);
  const medications = (snapshot.medications ?? []).map(formatMedication).filter((value): value is string => Boolean(value));
  const labTests = normalizeList(snapshot.lab_tests_ordered);

  if (complaint) {
    parts.push(`You were seen for ${complaint}.`);
  } else if (diagnosis.length) {
    parts.push(`You were seen for ${joinHumanList(diagnosis)}.`);
  }

  if (medications.length) {
    parts.push(`Medications: ${medications.join(" ")}`);
  }

  if (labTests.length) {
    parts.push(`Lab tests ordered: ${joinHumanList(labTests)}.`);
  }

  return parts.length ? parts.join(" ").replace(/\s+/g, " ").trim() : null;
}