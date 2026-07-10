import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Question } from "@/types";

interface PageImage {
  mimeType: string;
  data: string;
}

interface AiResult {
  years: {
    year: string;
    startPage: number;
    endPage: number;
    questions: Question[];
  }[];
}

function dataUrlToPageImage(dataUrl: string): PageImage {
  const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL");
  return { mimeType: matches[1], data: matches[2] };
}



export async function POST(request: Request) {
  try {
    const { pages, pageOffset = 0 } = await request.json();

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return Response.json({ error: "No pages provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const firstPage = pageOffset + 1;
    const lastPage = pageOffset + pages.length;
    const prompt = `You are a precise exam question extractor for Nigerian UTME exams. Extract ALL questions from the provided scanned page images.

These images correspond to actual pages ${firstPage} through ${lastPage} of a multi-year exam booklet.

For each page:
1. Detect year boundaries — each year's questions start on a specific page
2. Extract every question completely: number, text, options A-D, and the correct answer
3. Preserve mathematical equations in LaTeX (use $...$ for inline, $$...$$ for display)
4. Ignore headers, footers, page numbers, and instructions not related to specific questions
5. Determine which actual page numbers each year spans

Return ONLY valid JSON — no markdown, no explanation, no code fences. The response must parse as raw JSON.

JSON structure:
{
  "years": [
    {
      "year": "2024",
      "startPage": ${firstPage},
      "endPage": ${lastPage},
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "What is the SI unit of force?",
          "options": { "A": "Newton", "B": "Joule", "C": "Watt", "D": "Pascal" },
          "correctOption": "A",
          "explanation": ""
        }
      ]
    }
  ]
}

Rules:
- questionText: ONLY the question body, not options
- options: ONLY the option text, not the letter label
- correctOption: must be "A", "B", "C", or "D"; leave empty string if uncertain
- explanation: can be empty string
- startPage/endPage: use the actual page numbers shown above (not relative positions)
- If a page has no questions (e.g. cover, answer key section), skip it`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: prompt,
    });

    const parts = pages.map((url: string) => ({
      inlineData: dataUrlToPageImage(url),
    }));

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 65536,
      },
    });

    const text = result.response.text();

    const jsonMatch = text.replace(/```(?:json)?\s*/g, "").trim();
    const parsed: AiResult = JSON.parse(jsonMatch);

    return Response.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("AI extract error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
