export interface Question {
  questionNumber: number;
  questionText: string;
  explanation: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption: string;
}

export interface YearSplit {
  year: string;
  startPage: number;
  endPage: number;
}

export interface PageData {
  pageNumber: number;
  imageUrl: string;
  text: string;
}

export type ProcessingStatus = "idle" | "rendering" | "ocr" | "parsing" | "done" | "error";
