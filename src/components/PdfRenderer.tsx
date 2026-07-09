"use client";

import { useEffect, useState } from "react";

interface PdfRendererProps {
  file: File;
  onPagesRendered: (urls: string[]) => void;
}

export default function PdfRenderer({ file, onPagesRendered }: PdfRendererProps) {
  const [progress, setProgress] = useState("Loading PDF engine...");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

      if (cancelled) return;
      setProgress("Reading PDF...");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      if (cancelled) return;

      const total = pdf.numPages;
      const urls: string[] = [];

      for (let i = 1; i <= total; i++) {
        if (cancelled) return;
        setProgress(`Rendering page ${i}/${total}...`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        urls.push(canvas.toDataURL("image/png"));
      }

      if (!cancelled) {
        onPagesRendered(urls);
      }
    };

    load();

    return () => { cancelled = true; };
  }, [file, onPagesRendered]);

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{progress}</span>
    </div>
  );
}
