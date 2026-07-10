"use client";

import { useState, useCallback, useRef } from "react";
import type { AiExtractResult, Question } from "@/types";

const BATCH_SIZE = 8;
const MAX_WIDTH = 600;
const MAX_RETRIES = 3;

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

function usageKey(): string {
  return `ai-quota-${new Date().toISOString().slice(0, 10)}`;
}

function getDailyRequests(): number {
  try {
    return parseInt(localStorage.getItem(usageKey()) ?? "0", 10);
  } catch { return 0; }
}

function incrementDailyRequests(): void {
  try {
    const key = usageKey();
    localStorage.setItem(key, String(parseInt(localStorage.getItem(key) ?? "0", 10) + 1));
  } catch { /* ignore */ }
}

function mergeResults(results: AiExtractResult[]): AiExtractResult {
  const yearMap = new Map<string, { startPage: number; endPage: number; questions: Question[] }>();
  let totalPrompt = 0;
  let totalCandidate = 0;
  let totalTokens = 0;

  for (const result of results) {
    if (result._usage) {
      totalPrompt += result._usage.promptTokens;
      totalCandidate += result._usage.candidateTokens;
      totalTokens += result._usage.totalTokens;
    }

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

  const merged: AiExtractResult = {
    years: Array.from(yearMap.entries()).map(([year, data]) => ({
      year,
      startPage: data.startPage,
      endPage: data.endPage,
      questions: data.questions,
    })),
  };

  if (totalTokens > 0) {
    merged._usage = { promptTokens: totalPrompt, candidateTokens: totalCandidate, totalTokens };
  }

  return merged;
}

export default function AiExtractor({ pageImages, onComplete }: AiExtractorProps) {
  const [status, setStatus] = useState<"idle" | "compressing" | "extracting" | "partial_error" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [failedBatches, setFailedBatches] = useState<number[]>([]);
  const [totalRequestsToday, setTotalRequestsToday] = useState(getDailyRequests);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);

  const completedRef = useRef<AiExtractResult[]>([]);
  const compressedRef = useRef<string[] | null>(null);

  async function runBatches(
    compressed: string[],
    onProgress: (current: number, total: number, msg: string) => void,
    batchFilter?: Set<number>,
  ): Promise<number[]> {
    const totalBatches = Math.ceil(compressed.length / BATCH_SIZE);
    const failed: number[] = [];
    let tokAccum = 0;
    let reqAccum = 0;

    for (let b = 0; b < totalBatches; b++) {
      if (batchFilter && !batchFilter.has(b)) continue;
      const start = b * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, compressed.length);
      const batch = compressed.slice(start, end);
      onProgress(b + 1, totalBatches, `Batch ${b + 1}/${totalBatches} (pages ${start + 1}–${end})`);

      let batchOk = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
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
          completedRef.current.push(result);
          batchOk = true;

          if (result._usage) {
            tokAccum += result._usage.totalTokens;
          }
          reqAccum++;
          incrementDailyRequests();
          setTotalRequestsToday(getDailyRequests());
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const isRetryable =
            msg.includes("503") ||
            msg.includes("429") ||
            msg.includes("RECITATION") ||
            msg.includes("Candidate was blocked");

          if (attempt < MAX_RETRIES && isRetryable) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            onProgress(
              b + 1,
              totalBatches,
              `Batch ${b + 1}/${totalBatches} failed (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delay / 1000}s...`,
            );
            await new Promise((r) => setTimeout(r, delay));
          } else if (attempt < MAX_RETRIES) {
            throw err;
          } else {
            failed.push(b);
          }
        }
      }

      if (!batchOk) {
        onProgress(b + 1, totalBatches, `Batch ${b + 1}/${totalBatches} failed after ${MAX_RETRIES} attempts.`);
      }
    }

    setTotalTokens((prev) => prev + tokAccum);
    setTotalRequests((prev) => prev + reqAccum);
    return failed;
  }

  const finishAndComplete = useCallback(
    (partial: boolean, failed: number[]) => {
      const merged = mergeResults(completedRef.current);
      merged._partial = partial;
      merged._failedBatches = failed;
      setStatus("done");
      onComplete(merged);
    },
    [onComplete],
  );

  const startExtraction = useCallback(async () => {
    setStatus("compressing");
    setError(null);
    setProgress("Compressing page images...");
    setFailedBatches([]);
    setTotalTokens(0);
    setTotalRequests(0);
    completedRef.current = [];
    compressedRef.current = null;

    try {
      const compressed = await Promise.all(pageImages.map(compressImage));
      compressedRef.current = compressed;
      setStatus("extracting");

      const failed = await runBatches(compressed, (current, total, msg) => {
        setBatchProgress({ current, total });
        setProgress(msg);
      });

      setFailedBatches(failed);

      if (failed.length === 0) {
        finishAndComplete(false, []);
      } else {
        setStatus("partial_error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  }, [pageImages, finishAndComplete]);

  const handleRetryFailed = useCallback(async () => {
    setStatus("extracting");
    setError(null);
    setProgress("Retrying failed batches...");
    const compressed = compressedRef.current;
    if (!compressed) return;

    const failed = await runBatches(
      compressed,
      (current, total, msg) => {
        setBatchProgress({ current, total });
        setProgress(msg);
      },
      new Set(failedBatches),
    );

    setFailedBatches(failed);

    if (failed.length === 0) {
      finishAndComplete(false, []);
    } else {
      setStatus("partial_error");
    }
  }, [finishAndComplete, failedBatches]);

  const handleContinuePartial = useCallback(() => {
    finishAndComplete(true, failedBatches);
  }, [finishAndComplete, failedBatches]);

  if (status === "idle") {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          onClick={startExtraction}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          Extract with AI ✦
        </button>
        {totalRequestsToday > 0 && (
          <span className="text-xs text-zinc-400">
            {totalRequestsToday} / 1500 requests used today
          </span>
        )}
      </div>
    );
  }

  if (status === "compressing" || status === "extracting") {
    const isCompressing = status === "compressing";
    return (
      <div className="flex flex-col items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{progress}</span>
        </div>
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
        <span className="text-xs text-zinc-400">
          {totalRequestsToday} / 1500 requests used today
        </span>
      </div>
    );
  }

  if (status === "partial_error") {
    const totalBatches = Math.ceil(pageImages.length / BATCH_SIZE);
    const completed = totalBatches - failedBatches.length;
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {completed} of {totalBatches} batches completed. {failedBatches.length} batch{failedBatches.length > 1 ? "es" : ""} failed.
          </p>
          {totalRequests > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ~{totalTokens.toLocaleString()} total tokens across {totalRequests} requests. {totalRequestsToday} / 1500 requests used today.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetryFailed}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
          >
            Retry failed {failedBatches.length > 1 ? "batches" : "batch"}
          </button>
          <button
            onClick={handleContinuePartial}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900 transition-colors"
          >
            Continue with completed results
          </button>
        </div>
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
