"use client";

import { useState, useCallback } from "react";
import type { Question } from "@/types";
import { parseQuestions } from "@/lib/parser";
import LatexPreview from "./LatexPreview";

interface QuestionParserProps {
  pageTexts: string[];
  startPage: number;
  endPage: number;
  year: string;
  onQuestionsReady: (year: string, questions: Question[]) => void;
}

export default function QuestionParser({
  pageTexts,
  startPage,
  endPage,
  year,
  onQuestionsReady,
}: QuestionParserProps) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    parseQuestions(pageTexts.slice(startPage - 1, endPage))
  );
  const [initialParseDone] = useState(true);
  const [previewFields, setPreviewFields] = useState<Record<string, boolean>>({});

  const reparse = useCallback(() => {
    const parsed = parseQuestions(pageTexts.slice(startPage - 1, endPage));
    setQuestions(parsed);
  }, [pageTexts, startPage, endPage]);

  const togglePreview = useCallback((key: string) => {
    setPreviewFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateQuestionField = useCallback(
    (index: number, field: "questionText" | "explanation" | "correctOption", value: string) => {
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const updateOption = useCallback(
    (index: number, key: "A" | "B" | "C" | "D", value: string) => {
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], options: { ...next[index].options, [key]: value } };
        return next;
      });
    },
    []
  );

  const removeQuestion = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [
      ...prev,
      {
        questionNumber: prev.length + 1,
        questionText: "",
        explanation: "",
        options: { A: "", B: "", C: "", D: "" },
        correctOption: "",
      },
    ]);
  }, []);

  const confirmQuestions = useCallback(() => {
    const renumbered = questions.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    onQuestionsReady(year, renumbered);
  }, [questions, year, onQuestionsReady]);

  if (!initialParseDone) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{year} — {questions.length} questions</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={reparse}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Re-parse
          </button>
          <button
            onClick={addQuestion}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            + Add
          </button>
          <button
            onClick={confirmQuestions}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {q.questionNumber}
                </span>
              </div>
              <button
                onClick={() => removeQuestion(i)}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase">Question</label>
                  <button
                    onClick={() => togglePreview(`q-${i}-text`)}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {previewFields[`q-${i}-text`] ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewFields[`q-${i}-text`] ? (
                  <LatexPreview text={q.questionText} />
                ) : (
                  <textarea
                    value={q.questionText}
                    onChange={(e) => updateQuestionField(i, "questionText", e.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-lg border border-zinc-200 bg-white p-2.5 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["A", "B", "C", "D"] as const).map((key) => {
                  const previewKey = `q-${i}-opt-${key}`;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span
                        className={`mt-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
                          q.correctOption === key
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                        }`}
                      >
                        {key}
                      </span>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-end">
                          <button
                            onClick={() => togglePreview(previewKey)}
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            {previewFields[previewKey] ? "Edit" : "Preview"}
                          </button>
                        </div>
                        {previewFields[previewKey] ? (
                          <LatexPreview text={q.options[key]} />
                        ) : (
                          <textarea
                            value={q.options[key]}
                            onChange={(e) => updateOption(i, key, e.target.value)}
                            rows={1}
                            className="w-full resize-y rounded-lg border border-zinc-200 bg-white p-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase">Correct:</label>
                  {(["A", "B", "C", "D"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => updateQuestionField(i, "correctOption", key)}
                      className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
                        q.correctOption === key
                          ? "bg-green-500 text-white"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 uppercase">Explanation (optional)</label>
                  <button
                    onClick={() => togglePreview(`q-${i}-expl`)}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {previewFields[`q-${i}-expl`] ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewFields[`q-${i}-expl`] ? (
                  <LatexPreview text={q.explanation} />
                ) : (
                  <textarea
                    value={q.explanation}
                    onChange={(e) => updateQuestionField(i, "explanation", e.target.value)}
                    rows={1}
                    className="w-full resize-y rounded-lg border border-zinc-200 bg-white p-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                    placeholder="Explanation or solution..."
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
