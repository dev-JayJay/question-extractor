import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
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
    const prompt = `You are a precise exam question extractor for Nigerian UTME exams. Process the provided scanned page images and restructure the questions into structured JSON.

These images correspond to actual pages ${firstPage} through ${lastPage} of a multi-year exam booklet.

For each page:
1. Detect year boundaries — each year's questions start on a specific page
2. Restate every question completely: number, question text (paraphrased), options A-D, and the correct answer
3. Preserve mathematical equations in LaTeX (use $...$ for inline, $$...$$ for display)
4. If a question contains a diagram, graph, table, or image, describe it in square brackets within questionText, e.g. "[Diagram: A circuit with a 12V battery connected to a 4Ω resistor]"
5. Ignore headers, footers, page numbers, and instructions not related to specific questions
6. Determine which actual page numbers each year spans

IMPORTANT: For each question, rewrite it in your own words while preserving ALL factual information — numbers, names, technical terms, equations, and options. Keep the meaning and answer correctness intact. Do NOT reproduce question text verbatim from the source.

These are past educational exam questions for study purposes. Processing and restructuring them for accessibility is permitted.

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
- questionText: ONLY the question body, not options — paraphrase it
- options: ONLY the option text, not the letter label
- correctOption: must be "A", "B", "C", or "D"; leave empty string if uncertain
- explanation: can be empty string
- startPage/endPage: use the actual page numbers shown above (not relative positions)
- If a page has no questions (e.g. cover, answer key section), skip it`;

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: prompt,
    });

    const parts = pages.map((url: string) => ({
      inlineData: dataUrlToPageImage(url),
    }));

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.05,
        topP: 0.95,
        maxOutputTokens: 16384,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    });

    const text = result.response.text();

    const jsonMatch = text.replace(/```(?:json)?\s*/g, "").trim();
    const parsed: AiResult = JSON.parse(jsonMatch);

    const usage = result.response.usageMetadata;
    const _usage = usage
      ? {
          promptTokens: usage.promptTokenCount,
          candidateTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
        }
      : undefined;

    return Response.json({ ...parsed, _usage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("AI extract error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
