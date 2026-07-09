"use client";

import { useCallback, useState } from "react";
import PdfUploader from "@/components/PdfUploader";
import PdfRenderer from "@/components/PdfRenderer";
import OcrProcessor from "@/components/OcrProcessor";
import YearSplitter from "@/components/YearSplitter";
import QuestionParser from "@/components/QuestionParser";
import ExportButton from "@/components/ExportButton";
import type { YearSplit, Question } from "@/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [splits, setSplits] = useState<YearSplit[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<Record<string, Question[]>>({});
  const [viewing, setViewing] = useState<"upload" | "loading" | "preview">("upload");

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setPageImages([]);
    setPageTexts([]);
    setSplits([]);
    setParsedQuestions({});
    setViewing("loading");
  }, []);

  const handlePagesRendered = useCallback((urls: string[]) => {
    setPageImages(urls);
    setViewing("preview");
  }, []);

  const handleOcrComplete = useCallback((texts: string[]) => {
    setPageTexts(texts);
  }, []);

  const handleSplitsConfirmed = useCallback((confirmed: YearSplit[]) => {
    setSplits(confirmed);
  }, []);

  const handleQuestionsReady = useCallback((year: string, questions: Question[]) => {
    setParsedQuestions((prev) => ({ ...prev, [year]: questions }));
  }, []);

  const handleTextChange = useCallback((pageIndex: number, text: string) => {
    setPageTexts((prev) => {
      const next = [...prev];
      next[pageIndex] = text;
      return next;
    });
  }, []);

  const handleReset = () => {
    setFile(null);
    setPageImages([]);
    setPageTexts([]);
    setSplits([]);
    setParsedQuestions({});
    setViewing("upload");
  };

  const getPageLabel = (pageIndex: number): string | null => {
    const pageNum = pageIndex + 1;
    for (const split of splits) {
      if (pageNum >= split.startPage && pageNum <= split.endPage) {
        return split.year;
      }
    }
    return null;
  };

  const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500"];

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-xl font-bold">Question Extractor</h1>
        {viewing !== "upload" && (
          <button
            onClick={handleReset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Upload new PDF
          </button>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center p-6">
        {viewing === "upload" && (
          <div className="w-full max-w-2xl pt-12">
            <PdfUploader onFileSelect={handleFileSelect} />
          </div>
        )}

        {viewing === "loading" && file && (
          <div className="pt-12">
            <PdfRenderer file={file} onPagesRendered={handlePagesRendered} />
          </div>
        )}

        {viewing === "preview" && pageImages.length > 0 && (
          <div className="flex w-full max-w-6xl flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {file?.name} — {pageImages.length} pages
              </h2>
              {pageTexts.length === 0 && (
                <OcrProcessor
                  pageImages={pageImages}
                  onOcrComplete={handleOcrComplete}
                />
              )}
            </div>

            {pageTexts.length > 0 && splits.length === 0 && (
              <YearSplitter
                pageTexts={pageTexts}
                totalPages={pageImages.length}
                onSplitsConfirmed={handleSplitsConfirmed}
              />
            )}

            {splits.length > 0 && (
              <div className="space-y-8">
                <h3 className="text-lg font-semibold">Parsed Questions</h3>
                {splits.map((split, i) => {
                  const key = split.year || `year-${i}`;
                  if (parsedQuestions[key]) return null;
                  return (
                    <QuestionParser
                      key={key}
                      pageTexts={pageTexts}
                      startPage={split.startPage}
                      endPage={split.endPage}
                      year={split.year}
                      onQuestionsReady={handleQuestionsReady}
                    />
                  );
                })}
                {splits.every((s) => parsedQuestions[s.year || `year-${splits.indexOf(s)}`]) && (
                  <ExportButton
                    questions={parsedQuestions}
                    splits={splits}
                    fileName={file?.name || "questions"}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col items-center gap-8">
              {pageImages.map((url, i) => {
                const label = getPageLabel(i);
                const colorIdx = splits.findIndex(
                  (s) => i + 1 >= s.startPage && i + 1 <= s.endPage
                );
                return (
                  <div
                    key={i}
                    className="w-full overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        Page {i + 1}
                        {label && colorIdx !== -1 && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${colors[colorIdx % colors.length]}`}>
                            {label}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <img src={url} alt={`Page ${i + 1}`} className="w-full" />
                      </div>
                      <div>
                        <textarea
                          value={pageTexts[i] ?? ""}
                          onChange={(e) => handleTextChange(i, e.target.value)}
                          placeholder="OCR text will appear here..."
                          className="h-full min-h-[300px] w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 font-mono text-sm leading-relaxed text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder-zinc-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
