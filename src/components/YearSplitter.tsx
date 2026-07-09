"use client";

import { useState, useCallback } from "react";
import type { YearSplit } from "@/types";
import { detectYearSplits } from "@/lib/yearDetector";

interface YearSplitterProps {
  pageTexts: string[];
  totalPages: number;
  onSplitsConfirmed: (splits: YearSplit[]) => void;
}

function initSplits(pageTexts: string[], totalPages: number): YearSplit[] {
  const detected = detectYearSplits(pageTexts);
  return detected.length > 0 ? detected : [{ year: "unknown", startPage: 1, endPage: totalPages }];
}

export default function YearSplitter({ pageTexts, totalPages, onSplitsConfirmed }: YearSplitterProps) {
  const [splits, setSplits] = useState<YearSplit[]>(() => initSplits(pageTexts, totalPages));
  const [confirmed, setConfirmed] = useState(false);

  const updateSplit = useCallback((index: number, field: keyof YearSplit, value: string | number) => {
    setSplits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const addSplit = useCallback(() => {
    setSplits((prev) => [
      ...prev,
      { year: "", startPage: 1, endPage: totalPages },
    ]);
  }, [totalPages]);

  const removeSplit = useCallback((index: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(() => {
    const sorted = splits
      .map((s) => ({
        ...s,
        startPage: Math.max(1, Math.min(s.startPage, totalPages)),
        endPage: Math.max(s.startPage, Math.min(s.endPage, totalPages)),
      }))
      .sort((a, b) => a.startPage - b.startPage);

    setSplits(sorted);
    setConfirmed(true);
    onSplitsConfirmed(sorted);
  }, [splits, totalPages, onSplitsConfirmed]);

  if (confirmed) return null;

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold">Year Splits</h3>

      <div className="mb-6">
        <div className="relative h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800">
          {splits.map((split, i) => {
            const left = ((split.startPage - 1) / totalPages) * 100;
            const width = ((split.endPage - split.startPage + 1) / totalPages) * 100;
            const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500"];
            return (
              <div
                key={i}
                className={`absolute top-0 h-full rounded-lg ${colors[i % colors.length]} opacity-60`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${split.year}: Pages ${split.startPage}-${split.endPage}`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs text-zinc-400">
          <span>Page 1</span>
          <span>Page {totalPages}</span>
        </div>
      </div>

      <div className="space-y-3">
        {splits.map((split, i) => {
          const colors = ["border-blue-500", "border-emerald-500", "border-amber-500", "border-violet-500", "border-rose-500", "border-cyan-500"];
          return (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-3 rounded-lg border-l-4 bg-zinc-50 p-4 dark:bg-zinc-800/50 ${colors[i % colors.length]}`}
            >
              <input
                type="text"
                value={split.year}
                onChange={(e) => updateSplit(i, "year", e.target.value)}
                placeholder="Year (e.g. 2025)"
                className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm text-zinc-500">Pages</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={split.startPage}
                onChange={(e) => updateSplit(i, "startPage", Number(e.target.value))}
                className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-center dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm text-zinc-400">to</span>
              <input
                type="number"
                min={split.startPage}
                max={totalPages}
                value={split.endPage}
                onChange={(e) => updateSplit(i, "endPage", Number(e.target.value))}
                className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-center dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={() => removeSplit(i)}
                className="ml-auto rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={addSplit}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          + Add year
        </button>
        <button
          onClick={handleConfirm}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Confirm splits
        </button>
      </div>
    </div>
  );
}
