"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConsultationStore } from "@/store/consultationStore";
import type { TranscriptSegment } from "@/lib/types";

// ─── Medical keyword hints for Deepgram ──────────────────────────────────────
const MEDICAL_KEYWORDS = [
  "hypertension", "diabetes", "paracetamol", "metformin", "amlodipine",
  "atorvastatin", "omeprazole", "azithromycin", "amoxicillin", "ciprofloxacin",
  "dengue", "malaria", "typhoid", "tuberculosis", "COVID", "comorbidity",
  "tachycardia", "bradycardia", "tachypnea", "dyspnea", "hemoglobin",
  "creatinine", "bilirubin", "platelet", "leukocyte", "erythrocyte",
  "ECG", "MRI", "CT scan", "X-ray", "ultrasound", "CBC", "LFT", "RFT",
  "BP", "SpO2", "pulse", "temperature", "weight", "height", "BMI",
  "allergy", "anaphylaxis", "contraindication", "prescription", "dosage",
  "ICD", "SNOMED", "ABDM", "ABHA", "janaushadhi", "generic",
  // Hinglish medical terms
  "sugar", "pressure", "thakaan", "bukhar", "darrd", "khoon",
  "pet dard", "sar dard", "chakkar", "ulti", "dast",
];

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseMedicalScribeReturn {
  isRecording: boolean;
  isConnecting: boolean;
  transcript: string;
  interimText: string;
  detectedLanguage: string;
  wordCount: number;
  durationMs: number;
  segments: TranscriptSegment[];
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetTranscript: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMedicalScribe(consultationId?: string): UseMedicalScribeReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);

  const {
    scribe,
    setRecording,
    addSegment,
    setInterimText,
    setDetectedLanguage,
    setScribeError,
    incrementDuration,
    resetScribe,
  } = useConsultationStore();

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    recorderRef.current = null;
    mediaStreamRef.current = null;
    wsRef.current = null;
  }, []);

  // ─── Get Deepgram temp token from our API proxy ───────────────────────────
  const getDeepgramToken = async (): Promise<string> => {
    const res = await fetch("/api/transcribe", { method: "POST" });
    if (!res.ok) throw new Error("Failed to get transcription token");
    const { token } = await res.json();
    return token;
  };

  // ─── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (scribe.is_recording || isConnecting) return;

    try {
      setIsConnecting(true);
      setScribeError(null);

      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Get Deepgram token
      const token = await getDeepgramToken();

      // 3. Build Deepgram WebSocket URL
      // Using hi-Latn model handles Hinglish (Hindi written in Latin script)
      const params = new URLSearchParams({
        model: "nova-2",
        language: "hi-Latn",  // Hinglish: Hindi in Latin script
        smart_format: "true",
        punctuate: "true",
        interim_results: "true",
        endpointing: "300",
        keywords: MEDICAL_KEYWORDS.slice(0, 100).join(":5,"), // boost medical terms
      });

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      const ws = new WebSocket(wsUrl, ["token", token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setRecording(true);

        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          incrementDuration(1000);
        }, 1000);

        // Start sending audio chunks
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm",
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.start(250); // send audio every 250ms for low latency
        recorderRef.current = recorder;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Deepgram result message
          if (data.type === "Results" && data.channel?.alternatives?.[0]) {
            const alt = data.channel.alternatives[0];
            const text: string = alt.transcript ?? "";
            const isFinal: boolean = data.is_final ?? false;

            if (!text.trim()) return;

            // Detect language hints from Deepgram metadata
            if (data.metadata?.language) {
              setDetectedLanguage(data.metadata.language);
            } else if (/[\u0900-\u097F]/.test(text)) {
              setDetectedLanguage("hi");
            } else if (/\b(hai|hain|ka|ki|ke|nahi|kya|aur|mera|meri)\b/i.test(text)) {
              setDetectedLanguage("Hinglish");
            } else {
              setDetectedLanguage("en");
            }

            if (isFinal) {
              const segment: TranscriptSegment = {
                id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                text: text.trim(),
                is_final: true,
                timestamp: useConsultationStore.getState().scribe.duration_ms,
                language: useConsultationStore.getState().scribe.detected_language,
              };
              addSegment(segment);
              setInterimText("");
            } else {
              setInterimText(text);
            }
          }
        } catch {
          // Non-JSON message (keep-alive, etc.) — ignore
        }
      };

      ws.onerror = () => {
        setScribeError("WebSocket connection error. Check your API key and network.");
        setIsConnecting(false);
        cleanup();
        setRecording(false);
      };

      ws.onclose = (e) => {
        if (scribe.is_recording) {
          setScribeError(`Connection closed: ${e.reason || "Unknown reason"}`);
        }
        setRecording(false);
        setIsConnecting(false);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start recording";
      setScribeError(message);
      setIsConnecting(false);
      cleanup();
    }
  }, [
    scribe.is_recording,
    isConnecting,
    setRecording,
    addSegment,
    setInterimText,
    setDetectedLanguage,
    setScribeError,
    incrementDuration,
    cleanup,
  ]);

  // ─── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    cleanup();
    setRecording(false);
    setInterimText("");
  }, [cleanup, setRecording, setInterimText]);

  // ─── Reset transcript ─────────────────────────────────────────────────────
  const resetTranscript = useCallback(() => {
    stopRecording();
    resetScribe();
  }, [stopRecording, resetScribe]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording: scribe.is_recording,
    isConnecting,
    transcript: scribe.full_transcript,
    interimText: scribe.interim_text,
    detectedLanguage: scribe.detected_language,
    wordCount: scribe.word_count,
    durationMs: scribe.duration_ms,
    segments: scribe.segments,
    error: scribe.error,
    startRecording,
    stopRecording,
    resetTranscript,
  };
}
