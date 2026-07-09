import type { Question } from "@/types";

const Q_NUM_RE = /^[.\s]*(\d{1,3})\s*[.)\]]/;
const OPTION_RE = /^[.\s]*([A-D])[.)\]:]\s*/;
const ANSWER_RE = /(?:answer|ans|correct|key)\s*[:：]\s*([A-D])/i;

function cleanLine(line: string): string {
  return line.replace(/[|│┃]/g, "I").replace(/[•●·]/g, "").trim();
}

export function parseQuestions(rawPages: string[]): Question[] {
  const text = rawPages
    .map((page) =>
      page
        .split("\n")
        .map(cleanLine)
        .filter((l) => l.length > 0)
        .join("\n")
    )
    .join("\n");

  const lines = text.split("\n");
  const questions: Question[] = [];
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    const qMatch = Q_NUM_RE.exec(line);
    if (qMatch) {
      if (currentBlock.length > 0) blocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  for (const block of blocks) {
    if (block.length === 0) continue;

    const firstLine = block[0];
    const qMatch = Q_NUM_RE.exec(firstLine);
    if (!qMatch) continue;

    const questionNumber = parseInt(qMatch[1], 10);
    let questionText = firstLine.replace(Q_NUM_RE, "").trim();
    const options: Record<string, string> = { A: "", B: "", C: "", D: "" };
    let currentOption: string | null = null;
    const remainingLines = block.slice(1);

    for (const line of remainingLines) {
      const optMatch = OPTION_RE.exec(line);
      if (optMatch) {
        currentOption = optMatch[1];
        options[currentOption] = line.replace(OPTION_RE, "").trim();
      } else if (currentOption) {
        options[currentOption] += " " + line;
      } else {
        questionText += " " + line;
      }
    }

    let correctOption = "";
    if (!correctOption) {
      const joined = lines.join(" ");
      const ansMatch = ANSWER_RE.exec(joined);
      if (ansMatch) correctOption = ansMatch[1].toUpperCase();
    }

    questions.push({
      questionNumber,
      questionText: questionText || " ",
      explanation: "",
      options: { A: options.A, B: options.B, C: options.C, D: options.D },
      correctOption,
    });
  }

  return questions;
}

export function questionsToJson(questions: Question[]): string {
  return JSON.stringify(questions, null, 2);
}
