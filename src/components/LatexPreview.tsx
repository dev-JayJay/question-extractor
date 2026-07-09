"use client";

import { useRef, useEffect } from "react";
import katex from "katex";

interface LatexPreviewProps {
  text: string;
}

function renderInline(content: string): string {
  try {
    return katex.renderToString(content, { throwOnError: false, displayMode: false });
  } catch {
    return content;
  }
}

function renderDisplay(content: string): string {
  try {
    return katex.renderToString(content, { throwOnError: false, displayMode: true });
  } catch {
    return content;
  }
}

export default function LatexPreview({ text }: LatexPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const parts: { type: "text" | "inline" | "display"; content: string }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const displayMatch = remaining.match(/^\$\$(.*?)\$\$/s);
      if (displayMatch) {
        parts.push({ type: "display", content: displayMatch[1] });
        remaining = remaining.slice(displayMatch[0].length);
        continue;
      }
      const inlineMatch = remaining.match(/^\$(.*?)\$/s);
      if (inlineMatch) {
        parts.push({ type: "inline", content: inlineMatch[1] });
        remaining = remaining.slice(inlineMatch[0].length);
        continue;
      }
      const nextDollar = remaining.search(/\$/);
      if (nextDollar === 0) {
        remaining = remaining.slice(1);
        continue;
      }
      const textChunk = nextDollar > 0 ? remaining.slice(0, nextDollar) : remaining;
      parts.push({ type: "text", content: textChunk });
      remaining = nextDollar > 0 ? remaining.slice(nextDollar) : "";
    }

    ref.current.innerHTML = parts
      .map((p) => {
        if (p.type === "text") return escapeHtml(p.content);
        if (p.type === "inline") return renderInline(p.content);
        return renderDisplay(p.content);
      })
      .join("");

    if (ref.current.innerHTML.trim().length === 0) {
      ref.current.innerHTML = escapeHtml(text);
    }
  }, [text]);

  return (
    <div
      ref={ref}
      className="prose prose-sm max-w-none rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800 [&_.katex]:text-lg"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
