"use client";

import { useState, useCallback } from "react";
import type { AiExtractResult, Question } from "@/types";

const BATCH_SIZE = 8;
const MAX_WIDTH = 600;

interface AiExtractorProps {
  pageImages: string[];
  onComplete: (result: AiExtractResult) => void;
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

function mergeResults(results: AiExtractResult[]): AiExtractResult {
  const yearMap = new Map<string, { startPage: number; endPage: number; questions: Question[] }>();

  for (const result of results) {
    for (const year of result.years) {
      const existing = yearMap.get(year.year);
      if (existing) {
        existing.startPage = Math.min(existing.startPage, year.startPage);
        existing.endPage = Math.max(existing.endPage, year.endPage);
        const seen = new Set(existing.questions.map((q) => q.questionNumber));
        for (const q of year.questions) {
          if (!seen.has(q.questionNumber)) {
            existing.questions.push(q);
            seen.add(q.questionNumber);
          }
        }
        existing.questions.sort((a, b) => a.questionNumber - b.questionNumber);
      } else {
        yearMap.set(year.year, {
          startPage: year.startPage,
          endPage: year.endPage,
          questions: [...year.questions],
        });
      }
    }
  }

  return {
    years: Array.from(yearMap.entries()).map(([year, data]) => ({
      year,
      startPage: data.startPage,
      endPage: data.endPage,
      questions: data.questions,
    })),
  };
}

export default function AiExtractor({ pageImages, onComplete }: AiExtractorProps) {
  const [status, setStatus] = useState<"idle" | "compressing" | "extracting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const startExtraction = useCallback(async () => {
    setStatus("compressing");
    setError(null);
    setProgress("Compressing page images...");

    try {
      const compressed = await Promise.all(pageImages.map(compressImage));
      const totalBatches = Math.ceil(compressed.length / BATCH_SIZE);
      setBatchProgress({ current: 0, total: totalBatches });
      setStatus("extracting");

      const allResults: AiExtractResult[] = [];

      for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, compressed.length);
        const batch = compressed.slice(start, end);
        setBatchProgress({ current: b + 1, total: totalBatches });
        setProgress(`Batch ${b + 1}/${totalBatches} (pages ${start + 1}–${end})`);

        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: batch, pageOffset: start }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error: ${res.status}`);
        }

        const result: AiExtractResult = await res.json();
        allResults.push(result);
      }

      setProgress("Merging results...");
      const merged = mergeResults(allResults);
      setStatus("done");
      onComplete(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  }, [pageImages, onComplete]);

  if (status === "idle") {
    return (
      <button
        onClick={startExtraction}
        className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
      >
        Extract with AI ✦
      </button>
    );
  }

  if (status === "compressing" || status === "extracting") {
    const isCompressing = status === "compressing";
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{progress}</span>
        {!isCompressing && batchProgress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">
              {batchProgress.current}/{batchProgress.total}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={startExtraction}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
}
