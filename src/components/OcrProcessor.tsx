"use client";

import { useState, useCallback } from "react";
import { ocrAllPages } from "@/lib/ocr";

interface OcrProcessorProps {
  pageImages: string[];
  onOcrComplete: (texts: string[]) => void;
}

export default function OcrProcessor({ pageImages, onOcrComplete }: OcrProcessorProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageProgress, setPageProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startOcr = useCallback(async () => {
    setStatus("processing");
    setError(null);

    const texts = await ocrAllPages(
      pageImages,
      (pageIndex, progress) => {
        setCurrentPage(pageIndex + 1);
        setPageProgress(Math.round(progress * 100));
      },
      () => {},
      (pageIndex, msg) => {
        setError(`Page ${pageIndex + 1}: ${msg}`);
      }
    );

    setStatus("done");
    onOcrComplete(texts);
  }, [pageImages, onOcrComplete]);

  if (status === "idle") {
    return (
      <button
        onClick={startOcr}
        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        Run OCR on {pageImages.length} pages
      </button>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Page {currentPage}/{pageImages.length} — {pageProgress}%</span>
        </div>
        <div className="h-2 w-64 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{
              width: `${((currentPage - 1) * 100 + pageProgress) / pageImages.length}%`,
            }}
          />
        </div>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  return null;
}
