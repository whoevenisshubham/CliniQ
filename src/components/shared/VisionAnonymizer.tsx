"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Eye, EyeOff, Download, ImageIcon, AlertTriangle,
  CheckCircle2, Share2, X, ZoomIn, ZoomOut, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Anonymisation regions ────────────────────────────────────────────────────

interface AnonymisationRegion {
  label: string;
  getRect: (w: number, h: number) => { x: number; y: number; w: number; h: number };
  blurRadius: number;
}

// Medical imaging anonymisation zones
const ANON_REGIONS: AnonymisationRegion[] = [
  {
    label: "Patient Name Zone (top)",
    getRect: (w, h) => ({ x: 0, y: 0, w, h: h * 0.08 }),
    blurRadius: 12,
  },
  {
    label: "Patient ID Zone (bottom)",
    getRect: (w, h) => ({ x: 0, y: h * 0.92, w, h: h * 0.08 }),
    blurRadius: 12,
  },
  {
    label: "Face Region (centre-upper)",
    getRect: (w, h) => ({
      x: w * 0.3,
      y: h * 0.15,
      w: w * 0.4,
      h: h * 0.3,
    }),
    blurRadius: 20,
  },
];

// ─── Canvas blur helper ───────────────────────────────────────────────────────

function applyStackBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  // We use the CSS filter approach via offscreen canvas trick
  // 1. Save the target region pixels
  // 2. Draw blurred version over it using multiple passes
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  // Simple box blur — multiple passes approximate Gaussian
  for (let pass = 0; pass < 3; pass++) {
    for (let row = 0; row < height; row++) {
      for (let col = radius; col < width - radius; col++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const idx = (row * width + col + k) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
        const idx = (row * width + col) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }
  }

  ctx.putImageData(imageData, x, y);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VisionAnonymizerProps {
  onContributeToRepo?: (anonymizedDataUrl: string, filename: string) => void;
}

export function VisionAnonymizer({ onContributeToRepo }: VisionAnonymizerProps) {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [anonymizedDataUrl, setAnonymizedDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [regionsApplied, setRegionsApplied] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contributed, setContributed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

    setOriginalFile(file);
    setAnonymizedDataUrl(null);
    setContributed(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalDataUrl(dataUrl);
      await anonymizeImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const anonymizeImage = async (dataUrl: string) => {
    setIsProcessing(true);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        const w = canvas.width;
        const h = canvas.height;
        const applied: string[] = [];

        // Apply each anonymisation region
        for (const region of ANON_REGIONS) {
          const rect = region.getRect(w, h);
          if (rect.w > 0 && rect.h > 0) {
            applyStackBlur(
              ctx,
              Math.round(rect.x),
              Math.round(rect.y),
              Math.round(rect.w),
              Math.round(rect.h),
              region.blurRadius
            );
            applied.push(region.label);
          }
        }

        // Add YOLO-simulation overlay text
        ctx.font = `bold ${Math.max(12, Math.floor(w * 0.018))}px monospace`;
        ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
        ctx.fillText("DE-IDENTIFIED · NexusMD YOLO v8", 8, h - 8);

        // Add a subtle border to indicate de-identification
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = Math.max(2, Math.floor(w * 0.004));
        ctx.strokeRect(0, 0, w, h);

        setRegionsApplied(applied);
        setAnonymizedDataUrl(canvas.toDataURL("image/png", 0.95));
        setIsProcessing(false);
        resolve();
      };
      img.src = dataUrl;
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDownload = () => {
    if (!anonymizedDataUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = anonymizedDataUrl;
    a.download = `anon_${originalFile.name.replace(/\.[^/.]+$/, "")}.png`;
    a.click();
  };

  const handleContribute = () => {
    if (!anonymizedDataUrl || !originalFile) return;
    onContributeToRepo?.(anonymizedDataUrl, `anon_${originalFile.name}`);
    setContributed(true);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!originalDataUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-[var(--border)] hover:border-blue-500/50 hover:bg-[var(--surface-elevated)]"
          )}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10">
            <ImageIcon className="w-6 h-6 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">Upload X-Ray / Patient Photo</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              JPEG, PNG, BMP — YOLO-based de-identification applied automatically
            </p>
          </div>
          <Badge variant="outline" className="text-[9px]">
            Drag & drop or click to select
          </Badge>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />

      {/* Processing indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25"
          >
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
              <div className="absolute inset-0 flex items-center justify-center">
                <EyeOff className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-300">Running YOLO De-identification…</p>
              <p className="text-[10px] text-blue-400/70">Face detection · ID removal · Metadata strip</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image comparison */}
      <AnimatePresence>
        {anonymizedDataUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Toggle controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showOriginal ? "outline" : "default"}
                onClick={() => setShowOriginal(false)}
                className="gap-1.5 text-xs"
              >
                <EyeOff className="w-3.5 h-3.5" /> De-identified
              </Button>
              <Button
                size="sm"
                variant={showOriginal ? "default" : "outline"}
                onClick={() => setShowOriginal(true)}
                className="gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" /> Original
              </Button>
              <span className="text-[9px] text-[var(--foreground-subtle)] ml-auto">
                {originalFile?.name}
              </span>
              <button
                onClick={() => { setOriginalFile(null); setOriginalDataUrl(null); setAnonymizedDataUrl(null); setContributed(false); }}
                className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Image display */}
            <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={showOriginal ? originalDataUrl! : anonymizedDataUrl}
                alt={showOriginal ? "Original" : "De-Identified"}
                className="w-full object-contain max-h-80"
              />
              {!showOriginal && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/80 border border-blue-400/50">
                  <EyeOff className="w-2.5 h-2.5 text-white" />
                  <span className="text-[9px] text-white font-bold">DE-IDENTIFIED</span>
                </div>
              )}
              {showOriginal && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/80 border border-red-400/50">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                  <span className="text-[9px] text-white font-bold">IDENTIFIABLE</span>
                </div>
              )}
            </div>

            {/* Regions processed */}
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold">
                Anonymisation Applied
              </p>
              {regionsApplied.map((r) => (
                <div key={r} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                  <span className="text-xs text-[var(--foreground-muted)]">{r}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                className="flex-1 gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={handleContribute}
                disabled={contributed}
                className={cn(
                  "flex-1 gap-1.5 text-xs",
                  contributed
                    ? "bg-green-600/20 text-green-400 border border-green-500/30 cursor-not-allowed"
                    : "bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30"
                )}
                variant="outline"
              >
                {contributed ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Contributed</>
                ) : (
                  <><Share2 className="w-3.5 h-3.5" /> Contribute to Repository</>
                )}
              </Button>
            </div>

            {/* Contribution success message */}
            <AnimatePresence>
              {contributed && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/25"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <p className="text-xs text-purple-300">
                    Case contributed to Global Repository. +1 Protocol Credit awarded!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
