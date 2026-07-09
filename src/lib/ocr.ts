import Tesseract from "tesseract.js";

export async function ocrPage(
  imageUrl: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const { data } = await Tesseract.recognize(imageUrl, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress ?? 0);
      }
    },
  });
  return data.text;
}

export async function ocrAllPages(
  imageUrls: string[],
  onPageProgress?: (pageIndex: number, progress: number) => void,
  onPageComplete?: (pageIndex: number, text: string) => void,
  onError?: (pageIndex: number, error: string) => void
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const text = await ocrPage(imageUrls[i], (p) => {
        onPageProgress?.(i, p);
      });
      results.push(text);
      onPageComplete?.(i, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown OCR error";
      onError?.(i, msg);
      results.push("");
    }
  }

  return results;
}
