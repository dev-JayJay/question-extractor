"use client";

import { useState, useCallback } from "react";

interface AiExtractorProps {
  pageImages: string[];
  onComplete: (result: import("@/types").AiExtractResult) => void;
}

export default function AiExtractor({ pageImages, onComplete }: AiExtractorProps) {
  const [status, setStatus] = useState<"idle" | "extracting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const startExtraction = useCallback(async () => {
    setStatus("extracting");
    setError(null);
    setProgress("Sending pages to AI...");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pageImages }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }

      setProgress("Processing AI response...");
      const result = await res.json();
      setStatus("done");
      onComplete(result);
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

  if (status === "extracting") {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{progress}</span>
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
