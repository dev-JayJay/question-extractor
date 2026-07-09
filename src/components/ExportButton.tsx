"use client";

import { useCallback } from "react";
import type { Question, YearSplit } from "@/types";

interface ExportButtonProps {
  questions: Record<string, Question[]>;
  splits: YearSplit[];
  fileName: string;
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButton({ questions, splits, fileName }: ExportButtonProps) {
  const handleDownloadAll = useCallback(() => {
    for (const split of splits) {
      const year = split.year;
      const qs = questions[year];
      if (!qs || qs.length === 0) continue;

      const baseName = fileName.replace(/\.pdf$/i, "");
      const jsonFileName = `${baseName}-${year}-objective-questions.json`;
      downloadJson(qs, jsonFileName);
    }
  }, [questions, splits, fileName]);

  const handleDownloadYear = useCallback(
    (year: string) => {
      const qs = questions[year];
      if (!qs || qs.length === 0) return;
      const baseName = fileName.replace(/\.pdf$/i, "");
      const jsonFileName = `${baseName}-${year}-objective-questions.json`;
      downloadJson(qs, jsonFileName);
    },
    [questions, fileName]
  );

  const totalQuestions = Object.values(questions).reduce((sum, qs) => sum + qs.length, 0);
  if (totalQuestions === 0) return null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
      <h3 className="mb-3 text-lg font-semibold text-green-800 dark:text-green-300">Export</h3>
      <p className="mb-4 text-sm text-green-700 dark:text-green-400">
        {totalQuestions} questions across {Object.keys(questions).length} year(s) ready for export.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {splits.map((split) => {
          const year = split.year;
          const qs = questions[year];
          if (!qs || qs.length === 0) return null;
          return (
            <button
              key={year}
              onClick={() => handleDownloadYear(year)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow-sm ring-1 ring-green-300 hover:bg-green-50 dark:bg-green-900 dark:text-green-300 dark:ring-green-700 dark:hover:bg-green-800"
            >
              Download {year} ({qs.length} questions)
            </button>
          );
        })}
        {splits.length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          >
            Download all
          </button>
        )}
      </div>
    </div>
  );
}
