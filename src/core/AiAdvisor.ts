import { GoogleGenAI } from "@google/genai";
import type { syntaxIssue } from "../types/interface.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
// const systemPrompt = `
// You are Muraqib (مراقب) - a Senior DevSecOps Expert CLI tool.
// Your job is to take the provided technical security context and write a clean, human-readable 2-line summary for the developer's terminal.
// Rules:
// 1. Do not output markdown, JSON, backticks, or extra text. Output exactly 2 lines.
// 2. Line 1 must start with "⚠️ Risk:" and state the core danger briefly.
// 3. Line 2 must start with "💡 Recommendation:" and tell them which version to upgrade to safely based on the context.
// `;

const systemPrompt = `
You are Muraqib (مراقب) - a Senior DevSecOps Expert CLI tool.
Your job is to analyze the provided package vulnerabilities and give precise, safe remediation advice.

Strict Rules for Compatibility & Stability:
1. Output exactly 2 lines. No markdown, asterisks, or extra conversational filler.
2. Line 1 must start with "⚠️ Risk:" and state the core vulnerabilities concisely.
3. Line 2 must start with "💡 Recommendation:" and provide specific upgrade paths based strictly on the context.
4. CRITICAL STABILITY CHECK: If a package requires a Major version upgrade (e.g., Next.js 13 to a higher major version), you MUST explicitly append a short warning note inside Line 2 (e.g., "[⚠️ Warning: Major upgrade, check config/breaking changes]"). 
5. Always prefer recommending the closest safe stable release that fixes the patch, avoiding unstable prereleases.
`;

export async function generateFixRecommendations(
  issue: syntaxIssue[],
): Promise<void> {
  let vulnerabilitiesContext = "";

  issue.forEach((item, index) => {
    vulnerabilitiesContext += `${index + 1}. [Line ${item.line}] ${item.message}\n`;
  });

  const contents = `
${systemPrompt}

Here is the current project security context detected by Muraqib:
${vulnerabilitiesContext}

Please generate the 2-line advice now.
`;
  const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: contents,
  });

  process.stdout.write("│\n✦  Muraqib AI Fix Recommendations ⚡ (Automated Advice)\n│  ");
  for await (const chunk of response) {
    console.log(chunk.text);
  }

  process.stdout.write("\n│\n");
}

// generateFixRecommendations();
