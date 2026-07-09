import type { YearSplit } from "@/types";

const YEAR_PATTERNS = [
  /\b(?:UTME\s*)?(20\d{2})\s*(?:UTME)?\b/gi,
  /\b(?:Year|year)\s*(20\d{2})\b/g,
];

function extractYears(text: string): number[] {
  const years = new Set<number>();
  for (const pattern of YEAR_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const year = parseInt(match[1], 10);
      if (year >= 2000 && year <= 2099) {
        years.add(year);
      }
    }
  }
  return [...years].sort();
}

export function detectYearSplits(pageTexts: string[]): YearSplit[] {
  const splits: YearSplit[] = [];
  let currentYear: number | null = null;
  let startPage = 1;

  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    const foundYears = extractYears(text);

    const firstWordMatches = foundYears.length > 0 &&
      text.trim().split(/\s+/).slice(0, 20).join(" ").includes(String(foundYears[0]));

    if (firstWordMatches || foundYears.length === 1) {
      if (currentYear !== null && startPage < i + 1) {
        splits.push({
          year: String(currentYear),
          startPage,
          endPage: i,
        });
      }
      currentYear = foundYears[0];
      startPage = i + 1;
    }
  }

  if (currentYear !== null && startPage <= pageTexts.length) {
    splits.push({
      year: String(currentYear),
      startPage,
      endPage: pageTexts.length,
    });
  }

  if (splits.length === 0 && pageTexts.length > 0) {
    splits.push({
      year: "unknown",
      startPage: 1,
      endPage: pageTexts.length,
    });
  }

  return splits;
}

export function mergeConsecutivePages(
  splits: YearSplit[],
  totalPages: number
): YearSplit[] {
  return splits.map((s) => ({
    ...s,
    startPage: Math.max(1, Math.min(s.startPage, totalPages)),
    endPage: Math.max(s.startPage, Math.min(s.endPage, totalPages)),
  }));
}
